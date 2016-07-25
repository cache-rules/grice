from grice.errors import ConfigurationError, NotFoundError
from sqlalchemy import create_engine, MetaData, Column, Table, select
from sqlalchemy import engine
from sqlalchemy.engine import reflection

DEFAULT_PAGE = 0
DEFAULT_PER_PAGE = 50


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
        columns = []

        for column in table.columns:
            if column.name in column_names:
                columns.append(column)

    return {
        'name': table.name,
        'schema': table.schema,
        'columns': [column_to_dict(column) for column in columns]
    }


def names_to_columns(column_names, table_columns):
    column_names = column_names
    columns = []

    for column in table_columns:
        if column.name in column_names:
            columns.append(column)

    return columns


class DBService:
    """
    TODO:
        - Add methods for listing schemas
        - Add methods for querying tables
        - Add methods for saving table queries
    """
    def __init__(self, db_config):
        self.meta = MetaData()
        self.db = init_database(db_config)
        self._reflect_database()

    def _reflect_database(self):
        """
        TODO: introspect self.database and load table data into memory.
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

    def query_table(self, table_name, column_names: set=None, page: int=DEFAULT_PAGE, per_page: int=DEFAULT_PER_PAGE):
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
