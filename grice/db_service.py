from collections import namedtuple

from sqlalchemy.sql import Select

from grice.errors import ConfigurationError, NotFoundError, JoinError
from sqlalchemy import create_engine, MetaData, Column, Table, select, not_, or_, asc, desc, and_
from sqlalchemy import engine
from sqlalchemy.engine import reflection

DEFAULT_PAGE = 0
DEFAULT_PER_PAGE = 50
LIST_FILTERS = ['in', 'not_in', 'bt', 'nbt']
FILTER_TYPES = ['lt', 'lte', 'eq', 'neq', 'gt', 'gte'] + LIST_FILTERS
SORT_DIRECTIONS = ['asc', 'desc']
ColumnSort = namedtuple('ColumnSort', ['table_name', 'column_name', 'direction'])
ColumnPair = namedtuple('ColumnPair', ['from_column', 'to_column'])
TableJoin = namedtuple('TableJoin', ['table_name', 'column_pairs', 'outer_join'])


def init_database(db_config):
    """
    Creates a SqlAlchemy engine object from a config file.

    :param db_config:
    :return: SqlAlchemy engine object.
    """
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
    """
    Converts a SqlAlchemy Column object to a dict so we can return JSON.

    :param column: a SqlAlchemy Column
    :return: dict
    """
    foreign_keys = []

    for fk in column.foreign_keys:
        fk_column = fk.column
        foreign_keys.append({'name': fk_column.name, 'table_name': fk_column.table.name})

    data = {
        'name': column.name,
        'primary_key': column.primary_key,
        'nullable': column.nullable,
        'type': column.type.__class__.__name__,
        'foreign_keys': foreign_keys,
        'table': column.table.name
    }

    return data


def table_to_dict(table: Table):
    """
    Converts a SqlAlchemy Table object to a dict so we can return JSON.

    :param table: a SqlAlchemy Table
    :return: dict
    """
    return {
        'name': table.name,
        'schema': table.schema,
        'columns': [column_to_dict(column) for column in table.columns]
    }


def get_column(column_name, table: Table, join_table: Table):
    """
    Converts a column name to a column object.

    :param column_name: str, column_name strings, can be None.
    :param table: The main table.
    :param join_table: The table we are joining on, can be None.
    :return: SqlAlchemy column object.
    """
    table_name = None

    try:
        column_name, table_name = column_name.split('.')
    except ValueError:
        # This is fine, this means that this isn't a fully qualified column name.
        pass

    if table_name:
        if table_name == table.name:
            return table.columns.get(column_name, None)
        elif join_table is not None and table_name == join_table.name:
            return join_table.columns.get(column_name, None)
        else:
            return None

    return table.columns.get(column_name, None)


def names_to_columns(column_names, table: Table, join_table: Table):
    """
    Converts column names to columns. If column_names is None then we assume all columns are wanted.

    :param column_names: list of column_name strings, can be None.
    :param table: The main table.
    :param join_table: The table we are joining on, can be None.
    :return: list of SqlAlchemy column objects.
    """
    if column_names is None:
        columns = table.columns.values()

        if join_table is not None:
            columns = columns + join_table.columns.values()

        return columns

    columns = []

    for column_name in column_names:
        column = get_column(column_name, table, join_table)

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

        try:
            self.table_name, self.column_name = column_name.split('.')
        except ValueError:
            self.table_name = None
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

                    for value in self.url_value.split(';'):
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


def apply_column_filters(query, table: Table, join_table: Table, filters: dict):
    """
    Apply the ColumnFilters from the filters object to the query.

    - Goals is to be smart when applying filters.
        - multiple filters on a column should probably be OR'ed.
        - if lt value is smaller than gt value then we probably want to OR (i.e. lt 60 OR gt 120)
        - if lt value is bigger than gt value then we probably want to AND (i.e. lt 120 AND gt 60)
        - alternatively allow BETWEEN and NOT BETWEEN, and if multiples just OR those.
        - Filter sets between columns should be AND'ed.

    :param query: SQLAlchemy Select object.
    :param table: SQLAlchemy Table object.
    :param join_table: SQLAlchemy Table object.
    :param filters: The filters dict from db_controller.parse_filters: in form of column_name -> filters list
    :return: A SQLAlchemy select object with filters applied.
    """

    for column_name, filter_list in filters.items():
        column = get_column(column_name, table, join_table)

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


def apply_column_sorts(query, table: Table, join_table: Table, sorts: dict):
    """
    Adds sorts to a query object.

    :param query: A SQLAlchemy select object.
    :param table: The Table we are joining from.
    :param join_table: The Table we are joining to.
    :param sorts: List of ColumnSort objects.
    :return: A SQLAlchemy select object modified to with sorts.
    """
    for sort in sorts:
        if sort.table_name == table.name:
            column = table.columns.get(sort.column_name, None)
        elif join_table is not None and sort.table_name == join_table.name:
            column = join_table.columns.get(sort.column_name, None)

        if column is not None:
            if sort.direction == 'asc':
                query = query.order_by(asc(column))

            if sort.direction == 'desc':
                query = query.order_by(desc(column))

    return query


def apply_join(query: Select, table: Table, join_table: Table, join: TableJoin):
    """
    Performs a inner or outer join between two tables on a given query object.

    TODO: enable multiple joins

    :param query: A SQLAlchemy select object.
    :param table: The Table we are joining from.
    :param join_table: The Table we are joining to.
    :param join: The Join object describing how to join the tables.
    :return: A SQLAlchemy select object modified to join two tables.
    """
    error_msg = 'Invalid join, "{}" is not a column on table "{}"'
    join_conditions = []

    for column_pair in join.column_pairs:
        from_col = table.columns.get(column_pair.from_column)
        to_col = join_table.columns.get(column_pair.to_column)

        if from_col is None:
            raise ValueError(error_msg.format(column_pair.from_column, table.name))

        if to_col is None:
            raise ValueError(error_msg.format(column_pair.to_column, join_table.name))

        join_conditions.append(from_col == to_col)

    return query.select_from(table.join(join_table, onclause=and_(*join_conditions), isouter=join.outer_join))


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

    def get_table(self, table_name):
        table = self.meta.tables.get(table_name, None)

        if table is None:
            raise NotFoundError('Table "{}" does exist'.format(table_name))

        return table_to_dict(table)

    def query_table(self, table_name, column_names: list=None, page: int=DEFAULT_PAGE, per_page: int=DEFAULT_PER_PAGE,
                    filters: dict=None, sorts: dict=None, join: TableJoin=None):
        table = self.meta.tables.get(table_name, None)
        join_table = None

        if join is not None:
            join_table = self.meta.tables.get(join.table_name, None)

        rows = []

        if table is None:
            raise NotFoundError('Table "{}" does exist'.format(table_name))

        if join is not None and join_table is None:
            raise JoinError('Invalid join. Table with name "{}" does not exist.'.format(join.table_name))

        columns = names_to_columns(column_names, table, join_table)

        if len(columns) == 0:
            return [], []

        query = select(columns)

        if per_page > -1:
            query = query.limit(per_page).offset(page * per_page)

        if filters is not None:
            query = apply_column_filters(query, table, join_table, filters)

        if sorts is not None:
            query = apply_column_sorts(query, table, join_table, sorts)

        if join is not None:
            query = apply_join(query, table, join_table, join)

        with self.db.connect() as conn:
            result = conn.execute(query)

            for row in result:
                data = {}

                for column in columns:
                    full_column_name = column.table.name + '.' + column.name
                    data[full_column_name] = row[column]

                rows.append(data)

        column_data = [column_to_dict(column) for column in columns]

        return rows, column_data

if __name__ == '__main__':
    import configparser
    config = configparser.ConfigParser()
    config.read('../config.ini')
    s = DBService(config['database'])

