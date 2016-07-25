from grice.errors import ConfigurationError, NotFoundError
from sqlalchemy import create_engine, MetaData, Column, Table, select, not_, or_
from sqlalchemy import engine
from sqlalchemy.engine import reflection

DEFAULT_PAGE = 0
DEFAULT_PER_PAGE = 50
FILTER_TYPES = ['lt', 'lte', 'eq', 'neq', 'gt', 'gte', 'in', 'not_in', 'bt', 'nbt']
LIST_FILTERS = ['in', 'not_in', 'bt', 'nbt']


def init_database(db_config):
    try:
        db_args = {
            'username': db_config['username'],
            'password': db_config['password'],
            'host': db_config['host'],
            'port': db_config['port'],
            'database': db_config['database']
        }
    except KeyError:
        msg = '"username", "password", "host", "port", and "database" are required fields of database config'
        raise ConfigurationError(msg)

    eng_url = engine.url.URL('postgresql', **db_args)

    return create_engine(eng_url)


def column_to_dict(column: Column):
    foreign_keys = []

    for fk in column.foreign_keys:
        fk_column = fk.column
        foreign_keys.append({'name': fk_column.name, 'table_name': fk_column.table.name})

    return {
        'name': column.name,
        'primary_key': column.primary_key,
        'nullable': column.nullable,
        'type': column.type.__class__.__name__,
        'foreign_keys': foreign_keys
    }


def table_to_dict(table: Table, column_names: set=None):
    columns = table.columns

    if column_names:
        columns = names_to_columns(column_names, table.columns)

    return {
        'name': table.name,
        'schema': table.schema,
        'columns': [column_to_dict(column) for column in columns]
    }


def names_to_columns(column_names, table_columns):
    columns = []

    for column_name in column_names:
        column = table_columns.get(column_name)

        if column is not None:
            columns.append(column)

    return columns


def convert_url_value(url_value: str, column: Column):
    """
    Converts a given string value to the given Column's type.
    :param url_value: a string
    :param column: a sqlalchemy Column object
    :return: value converted to type in column object.
    """
    if column.type.python_type == bool:
        return url_value.lower() == 'true'
    else:
        return column.type.python_type(url_value)


class ColumnFilter:
    def __init__(self, column_name, filter_type, value=None, url_value=None, column: Column=None):
        """
        ColumnFilter will be used to apply filters to a column when using the table query API. They are parsed from the
        url via db_controller.parse_filters.

        :param column_name: The name of the column to filter
        :param filter_type: The type of filter to apply, must one of FILTER_TYPES.
        :param value: The value to apply with the filter type converted to the appropriate type via the column object.
        :param url_value: The value that came from the URL
        :param column: The SQLAlchemy Column object from the table.
        :return:
        """
        if filter_type not in FILTER_TYPES:
            raise ValueError('Invalid filter type "{}", valid types: {}'.format(filter_type, FILTER_TYPES))

        self.column_name = column_name
        self.filter_type = filter_type
        self.value = value
        self.url_value = url_value
        self._column = column

        if self._column is not None and self.url_value is not None:
            self.value = convert_url_value(url_value, self.column)

    @property
    def column(self):
        return self._column

    @column.setter
    def column(self, column):
        try:
            if self.url_value is not None:
                if self.filter_type in LIST_FILTERS:
                    values = []

                    for value in self.url_value.split(','):
                        values.append(convert_url_value(value, column))

                    self.value = values
                else:
                    self.value = convert_url_value(self.url_value, column)
        except (ValueError, TypeError):
            raise(ValueError('Invalid value "{}" for type "{}"'.format(self.url_value, column.type.python_type)))

        self._column = column


def get_filter_expression(column: Column, column_filter: ColumnFilter):
    """
    Given a Column and ColumnFilter return an expression to use as a filter.
    :param column: sqlalchemy Column object
    :param column_filter: ColumnFilter object
    :return: sqlalchemy expression object
    """
    try:
        column_filter.column = column
    except ValueError:
        # Ignore bad filters.
        return None

    value = column_filter.value
    filter_type = column_filter.filter_type

    if filter_type == 'lt':
        return column < value
    elif filter_type == 'lte':
        return column <= value
    elif filter_type == 'eq':
        return column == value
    elif filter_type == 'neq':
        return column != value
    elif filter_type == 'gt':
        return column > value
    elif filter_type == 'gte':
        return column >= value
    elif filter_type == 'in':
        return column.in_(value)
    elif filter_type == 'not_in':
        return not_(column.in_(value))
    elif filter_type == 'bt':
        return column.between(*value)
    elif filter_type == 'nbt':
        return not_(column.between(*value))

    return None


def get_filter_expressions(column, filter_list: list):
    """
    Given a Column and a list of ColumnFilters return a filter expression.

    :param column: sqlalchemy Column
    :param filter_list: a list of ColumnFilter objects
    :return: list of sqlalchemy expression objects
    """
    expressions = []

    for column_filter in filter_list:
        expr = get_filter_expression(column, column_filter)

        if expr is not None:
            expressions.append(expr)

    return expressions


def apply_column_filters(table: Table, query, filters: dict):
    """
    Apply the ColumnFilters from the filters object to the query.

    - Goals is to be smart when applying filters.
        - multiple filters on a column should probably be OR'ed.
        - if lt value is smaller than gt value then we probably want to OR (i.e. lt 60 OR gt 120)
        - if lt value is bigger than gt value then we probably want to AND (i.e. lt 120 AND gt 60)
        - alternatively allow BETWEEN and NOT BETWEEN, and if multiples just OR those.
        - Filter sets between columns should be AND'ed.

    :param table: SQLAlchemy Table object.
    :param query: SQLAlchemy Select object.
    :param filters: The filters dict from db_controller.parse_filters: in form of column_name -> filters list
    :return:
    """

    for column_name, filter_list in filters.items():
        column = table.columns.get(column_name)

        if column is not None:
            filter_expressions = get_filter_expressions(column, filter_list)
            number_of_filters = len(filter_expressions)

            if number_of_filters == 0:
                # No valid filters for this column, so just continue.
                continue
            if number_of_filters == 1:
                # If we only have one filter then just put it in a where clause.
                query = query.where(filter_expressions[0])
            else:
                # If we have more than one filter then OR all filters
                query = query.where(or_(filter_expressions))

    return query


class DBService:
    """
    TODO:
        - Add methods for saving table queries
    """
    def __init__(self, db_config):
        self.meta = MetaData()
        self.db = init_database(db_config)
        self._reflect_database()

    def _reflect_database(self):
        """
        This method reflects the database and also instantiates an Inspector.
        :return:
        """
        self.meta.reflect(bind=self.db)
        self.inspector = reflection.Inspector.from_engine(self.db)

    def get_tables(self):
        schemas = {}

        for table in self.meta.sorted_tables:
            schema = table.schema

            if schema not in schemas:
                schemas[schema] = {}

            schemas[schema][table.name] = table_to_dict(table)

        return schemas

    def get_table(self, table_name, column_names: set=None):
        table = self.meta.tables.get(table_name, None)

        if table is None:
            raise NotFoundError('table "{}" does exist'.format(table_name))

        return table_to_dict(table, column_names)

    def query_table(self, table_name, column_names: set=None, page: int=DEFAULT_PAGE, per_page: int=DEFAULT_PER_PAGE,
                    filters: dict=None):
        table = self.meta.tables.get(table_name, None)
        rows = []

        if column_names is None:
            columns = table.columns
        else:
            columns = names_to_columns(column_names, table.columns)

        if len(columns) == 0:
            return []

        query = select(columns)

        if per_page > -1:
            query = query.limit(per_page).offset(page * per_page)

        if filters is not None:
            query = apply_column_filters(table, query, filters)

        with self.db.connect() as conn:
            result = conn.execute(query)

            for row in result:
                rows.append(dict(row))

        return rows

if __name__ == '__main__':
    import configparser
    config = configparser.ConfigParser()
    config.read('../config.ini')
    s = DBService(config['database'])
    r = s.query_table('device_args', ['name', 'device_id'])
    print(r)
