from grice.db_service import DBService
from flask import Flask, jsonify

from grice.errors import NotFoundError


class DBController:
    def __init__(self, app: Flask, db_service: DBService):
        self.app = app
        self.db_service = db_service
        self.register_routes()

    def tables_page(self):
        return jsonify(schemas=self.db_service.get_tables())

    tables_page.methods = ['GET']

    def table_page(self, name):
        try:
            table_info = self.db_service.get_table(name)
        except NotFoundError as e:
            return jsonify(success=False, error=str(e)), 404

        return jsonify(**table_info)

    table_page.methods = ['GET', 'POST']

    def data_page(self, name):
        try:
            table_info = self.db_service.get_table(name)
        except NotFoundError as e:
            return jsonify(success=False, error=str(e)), 404

        table_info['rows'] = self.db_service.query_table(name)

        return jsonify(**table_info)

    data_page.methods = ['GET']

    def register_routes(self):
        self.app.add_url_rule('/api/db', 'index', self.tables_page)
        self.app.add_url_rule('/api/db/tables', 'tables', self.tables_page)
        self.app.add_url_rule('/api/db/tables/<name>', 'table', self.table_page)
        self.app.add_url_rule('/api/db/tables/<name>/data', 'data', self.data_page)
