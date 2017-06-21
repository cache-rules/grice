import logging
from collections import namedtuple
import urllib

from sqlalchemy import create_engine, MetaData, Column, Table, select, asc, desc, and_
from sqlalchemy import engine
from sqlalchemy.sql import Select
from sqlalchemy.sql.functions import Function
from sqlalchemy.engine import reflection
from grice.complex_filter import ComplexFilter, get_column
from grice.errors import ConfigurationError, NotFoundError, JoinError

log = logging.getLogger(__name__)  # pylint: disable=invalid-name

DEFAULT_PAGE = 0
DEFAULT_PER_PAGE = 50
SORT_DIRECTIONS = ['asc', 'desc']
SUPPORTED_FUNCS = ['avg', 'count', 'min', 'max', 'sum']
ColumnSort = namedtuple('ColumnSort', ['table_name', 'column_name', 'direction'])
ColumnPair = namedtuple('ColumnPair', ['from_column', 'to_column'])
TableJoin = namedtuple('TableJoin', ['table_name', 'column_pairs', 'outer_join'])
QueryArguments = namedtuple('QueryArguments', ['column_names', 'page', 'per_page', 'filters', 'sorts', 'join', 'group_by', 'format_as_list'])

def init_database(db_config):
    """
    Creates a SqlAlchemy engine object from a config file.

    :param db_config:
    :return: SqlAlchemy engine object.
    """
    driver = db_config.get('driver', 'postgresql')
    try:
        db_args = {
            'username': db_config['username'],
            'password': db_config['password'],
            'host': db_config['host'],
            'port': db_config['port'],
            'database': db_config['database']
        }
        if 'query' in db_config:
            db_args['query'] = dict(urllib.parse.parse_qsl(db_config['query'], keep_blank_values=True))
    except KeyError:
        msg = '"username", "password", "host", "port", and "database" are required fields of database config'
        raise ConfigurationError(msg)

    eng_url = engine.url.URL(driver, **db_args)

    return create_engine(eng_url)


def function_to_dict(func: Function):
    data = {
        'name': str(func),
        'primary_key': func.primary_key,
        'table': '<Function {}>'.format(func.name),
    }
    return data

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


def names_to_columns(column_names, table: Table, join_table: Table):
    """
    Converts column names to columns. If column_names is None then we assume all columns are wanted.

    :param column_names: list of column_name strings, can be None.
    :param table: The main table.
    :param join_table: The table we are joining on, can be None.
    :return: list of SqlAlchemy column objects.
    """
    if not column_names:
        columns = table.columns.values()

        if join_table is not None:
            columns = columns + join_table.columns.values()

        return columns

    columns = []

    for column_name in column_names:
        column = get_column(column_name, [table, join_table])

        if column is not None:
            columns.append(column)

    return columns


def apply_column_filters(query, table: Table, join_table: Table, filters: ComplexFilter):
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

    expression = filters.get_expression([table, join_table])
    if expression is not None:
        query = query.where(expression)

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

def apply_group_by(query, table: Table, join_table: Table, group_by: list):
    """
    Adds sorts to a query object.

    :param query: A SQLAlchemy select object.
    :param table: The Table we are joining from.
    :param join_table: The Table we are joining to.
    :param sorts: List of ColumnSort objects.
    :return: A SQLAlchemy select object modified to with sorts.
    """
    for group in group_by:
        column = table.columns.get(group, None)
        if join_table is not None and not column:
            column = join_table.columns.get(group, None)

        if column is not None:
            query = query.group_by(column)

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

    def query_table(self, table_name: str, quargs: QueryArguments):  # pylint: disable=too-many-branches, too-many-statements, too-many-locals

        table = self.meta.tables.get(table_name, None)
        join_table = None

        if quargs.join is not None:
            join_table = self.meta.tables.get(quargs.join.table_name, None)

        rows = []

        if table is None:
            raise NotFoundError('Table "{}" does exist'.format(quargs.table_name))

        if quargs.join is not None and join_table is None:
            raise JoinError('Invalid join. Table with name "{}" does not exist.'.format(quargs.join.table_name))

        columns = names_to_columns(quargs.column_names, table, join_table)

        if len(columns) == 0:
            return [], []

        query = select(columns).apply_labels()

        if quargs.per_page > -1:
            query = query.limit(quargs.per_page).offset(quargs.page * quargs.per_page)

        if quargs.filters is not None:
            query = apply_column_filters(query, table, join_table, quargs.filters)

        if quargs.sorts is not None:
            query = apply_column_sorts(query, table, join_table, quargs.sorts)

        if quargs.join is not None:
            query = apply_join(query, table, join_table, quargs.join)

        if quargs.group_by is not None:
            query = apply_group_by(query, table, join_table, quargs.group_by)

        with self.db.connect() as conn:
            log.debug("Query %s", query)
            result = conn.execute(query)

            for row in result:
                count_of_map = {}
                if quargs.format_as_list:
                    data = []
                    for column in columns:
                        if isinstance(column, Function):
                            counter = count_of_map.get(column.name, 0) + 1
                            count_of_map[column.name] = counter
                            column_label = column.name + '_' + str(counter)
                        else:
                            column_label = column.table.name + '_' + column.name
                        data.append(row[column_label])
                else:
                    data = {}
                    for column in columns:
                        if isinstance(column, Function):
                            counter = count_of_map.get(column.name, 0) + 1
                            count_of_map[column.name] = counter
                            full_column_name = column.name + '_' + str(counter)
                            column_label = column.name + '_' + str(counter)
                        else:
                            full_column_name = column.table.name + '.' + column.name
                            column_label = column.table.name + '_' + column.name
                        data[full_column_name] = row[column_label]

                rows.append(data)

        column_data = [column_to_dict(column) if isinstance(column, Column) else function_to_dict(column) for column in columns]

        return rows, column_data

if __name__ == '__main__':
    import configparser
    config = configparser.ConfigParser()
    config.read('../config.ini')
    s = DBService(config['database'])
