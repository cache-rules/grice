from grice.db_service import DBService
from flask import Flask, jsonify, render_template

from grice.errors import NotFoundError


class DBController:
    def __init__(self, app: Flask, db_service: DBService):
        self.app = app
        self.db_service = db_service
        self.register_routes()

    def tables_api(self):
        return jsonify(schemas=self.db_service.get_tables())

    tables_api.methods = ['GET']

    def table_api(self, name):
        try:
            table_info = self.db_service.get_table(name)
        except NotFoundError as e:
            return jsonify(success=False, error=str(e)), 404

        return jsonify(**table_info)

    table_api.methods = ['GET', 'POST']

    def query_api(self, name):
        try:
            table_info = self.db_service.get_table(name)
        except NotFoundError as e:
            return jsonify(success=False, error=str(e)), 404

        table_info['rows'] = self.db_service.query_table(name)

        return jsonify(**table_info)

    query_api.methods = ['GET']

    def tables_page(self):
        tables = self.db_service.get_tables()

        return render_template('tables.html', tables=tables)

    tables_page.methods = ['GET']

    def table_page(self, name):
        try:
            table = self.db_service.get_table(name)
        except NotFoundError as e:
            return jsonify(success=False, error=str(e)), 404

        rows = self.db_service.query_table(name)
        title = "{} - Grice".format(name)

        return render_template('table.html', title=title, table=table, rows=rows)

    table_page.methods = ['GET']

    def register_routes(self):
        # API Routes
        self.app.add_url_rule('/api/db/tables', 'tables_api', self.tables_api)
        self.app.add_url_rule('/api/db/tables/<name>', 'table_api', self.table_api)
        self.app.add_url_rule('/api/db/tables/<name>/query', 'query_api', self.query_api)

        # HTML Pages
        self.app.add_url_rule('/db', 'db_index', self.tables_page)
        self.app.add_url_rule('/db/tables', 'tables_page', self.tables_page)
        self.app.add_url_rule('/db/tables/<name>', 'table_page', self.table_page)
