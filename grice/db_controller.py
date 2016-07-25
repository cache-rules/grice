from grice.db_service import DBService, DEFAULT_PAGE, DEFAULT_PER_PAGE, ColumnFilter
from flask import Flask, jsonify, render_template, request

from grice.errors import NotFoundError


def parse_filter(filter_string: str):
    try:
        column_name, filter_type, url_value = filter_string.split(',')
    except ValueError:
        return None

    return ColumnFilter(column_name, filter_type, url_value=url_value)


def parse_filters(filter_list):
    """
    This method parses the filter strings from the URL.

    :param filter_list: List of filter strings from the URL.
    :return: dict of column_name -> ColumnFilter
    """
    filters = {}

    for filter_string in filter_list:
        try:
            column_filter = parse_filter(filter_string)
        except ValueError:
            # This means that the filter is not an acceptable filter type, so we'll ignore it.
            continue

        if column_filter is not None:
            column_name = column_filter.column_name

            if column_name not in filters:
                filters[column_filter.column_name] = []

            filters[column_name].append(column_filter)

    if len(filters):
        return filters

    return None


def parse_query_args(query_args):
    """
    This method takes the query string from the request and returns all of the items related to the query API.

    :param query_args: The query args from flask.request.args
    :return: column_names: list, page: int, per_page: int, filters: dict
    """
    filters = parse_filters(query_args.getlist('filter'))
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

    return column_names, page, per_page, filters


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
        column_names, page, per_page, filters = parse_query_args(request.args)

        try:
            table_info = self.db_service.get_table(name, column_names)
        except NotFoundError as e:
            return jsonify(success=False, error=str(e)), 404

        table_info['rows'] = self.db_service.query_table(name, column_names, page, per_page, filters)

        return jsonify(**table_info)

    query_api.methods = ['GET']

    def tables_page(self):
        tables = self.db_service.get_tables()

        return render_template('tables.html', tables=tables)

    tables_page.methods = ['GET']

    def table_page(self, name):
        column_names, page, per_page, filters = parse_query_args(request.args)

        try:
            table = self.db_service.get_table(name, column_names)
        except NotFoundError as e:
            return jsonify(success=False, error=str(e)), 404

        rows = self.db_service.query_table(name, column_names, page, per_page, filters)
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
