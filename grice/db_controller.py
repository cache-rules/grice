from grice.db_service import DBService, DEFAULT_PAGE, DEFAULT_PER_PAGE
from flask import Flask, jsonify, render_template, request

from grice.errors import NotFoundError


def parse_query_args(query_args):
    column_names = query_args.get('cols', None)

    try:
        page = int(query_args.get('page', 1)) - 1
    except ValueError:
        page = DEFAULT_PAGE

    per_page = query_args.get('perPage', None)

    if per_page is not None:
        try:
            per_page = int(per_page)
        except ValueError:
            per_page = None

    if per_page is None:
        per_page = DEFAULT_PER_PAGE

    if page < 0:
        page = DEFAULT_PAGE

    if column_names:
        column_names = set([column_name.strip() for column_name in column_names.split(',')])

    return column_names, page, per_page


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
        column_names, page, per_page = parse_query_args(request.args)

        try:
            table_info = self.db_service.get_table(name, column_names)
        except NotFoundError as e:
            return jsonify(success=False, error=str(e)), 404

        table_info['rows'] = self.db_service.query_table(name, column_names, page, per_page)

        return jsonify(**table_info)

    query_api.methods = ['GET']

    def tables_page(self):
        tables = self.db_service.get_tables()

        return render_template('tables.html', tables=tables)

    tables_page.methods = ['GET']

    def table_page(self, name):
        column_names, page, per_page = parse_query_args(request.args)

        try:
            table = self.db_service.get_table(name, column_names)
        except NotFoundError as e:
            return jsonify(success=False, error=str(e)), 404

        rows = self.db_service.query_table(name, column_names, page, per_page)
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
