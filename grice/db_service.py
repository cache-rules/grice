from grice.errors import ConfigurationError
from sqlalchemy import create_engine, MetaData, Column, Table, select
from sqlalchemy import engine
from sqlalchemy.engine import reflection


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
        msg = 'Config entries "username", "password", "host", "port", and "database" are'
        msg += ' required to initialize the database module.'
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


def table_to_dict(table: Table):
    return {
        'name': table.name,
        'schema': table.schema,
        'columns': [column_to_dict(column) for column in table.columns]
    }


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

    def get_table(self, table_name):
        table = self.meta.tables.get(table_name, None)

        if table is None:
            return None

        return table_to_dict(table)

    def query_table(self, table_name, column_names=None, page=0, per_page=50):
        table = self.meta.tables.get(table_name, None)
        rows = []

        if column_names is None:
            columns = table.columns
        else:
            columns = []
            column_names = set(column_names)

            for column in table.columns:
                if column.name in column_names:
                    columns.append(column)

        with self.db.connect() as conn:
            result = conn.execute(select(columns).limit(per_page).offset(page * per_page))

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