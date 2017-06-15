from collections import OrderedDict

from grice.db_service import DBService, DEFAULT_PAGE, DEFAULT_PER_PAGE, ColumnFilter, ColumnSort, SORT_DIRECTIONS, \
    ColumnPair, TableJoin
from flask import Flask, jsonify, render_template, request

from grice.errors import NotFoundError, JoinError


def parse_pagination(page, per_page):
    try:
        page = int(page) - 1
    except (ValueError, TypeError):
        page = DEFAULT_PAGE

    try:
        per_page = int(per_page)
    except (ValueError, TypeError):
        per_page = DEFAULT_PER_PAGE

    if page < 0:
        page = DEFAULT_PAGE

    return page, per_page


def parse_filter(filter_string: str):
    """
    Parses a filter string from the URL.

    expected format:
        column_name,filter_type,value for single value filters i.e. eq, lt, gt.
        column_name,filter_type,values;delimited;with;semicolons for multi-value filters i.e. in, not_in, between.

    :param filter_string: the filter string from the URL.
    :return: ColumnFilter
    """
    column_name, filter_type, url_value = [s.strip() for s in filter_string.split(',')]

    return ColumnFilter(column_name, filter_type, url_value=url_value)


def parse_filters(filter_list):
    """
    Parses the filter strings from the URL.

    :param filter_list: List of filter strings from the URL.
    :return: dict of column_name -> ColumnFilter
    """
    filters = {}

    for filter_string in filter_list:
        try:
            column_filter = parse_filter(filter_string)
        except ValueError:
            # This means that the filter is not an acceptable filter type, so we'll ignore it. We should consider
            # notifying the user that their filter was wrong.
            continue

        if column_filter is not None:
            column_name = column_filter.column_name

            if column_name not in filters:
                filters[column_name] = []

            filters[column_name].append(column_filter)

    if len(filters):
        return filters

    return None


def parse_sort(sort_string):
    """
    Parses a sort from the URL.

    expected format: column_name,direction where direction is 'asc' or 'desc'

    :param sort_string: string
    :return:
    """
    table_name = None
    column_name, direction = [s.strip() for s in sort_string.split(',')]
    direction = direction.lower()

    if column_name == '':
        raise ValueError('column_name cannot be blank')

    if direction.lower() not in SORT_DIRECTIONS:
        raise ValueError('invalid sort direction')

    try:
        table_name, column_name = column_name.split('.')
    except ValueError:
        # This means the column name is not in the table_name.column_name format, which is fine.
        pass

    return ColumnSort(table_name, column_name, direction)


def parse_sorts(sort_list):
    """
    This method parses sort strings from the URL.

    :param sort_list:
    :return:
    """

    # It only makes sense to have one sort per column, so we stash sorts in a dict. If multiple sorts exist for a
    # column, then we only keep the last sort for that column.
    sorts = OrderedDict()

    for sort_string in sort_list:
        try:
            column_sort = parse_sort(sort_string)
        except ValueError:
            continue

        sorts[column_sort.column_name] = column_sort

    if len(sorts):
        return list(sorts.values())

    return None


def parse_join(join_str, outer_join: bool):
    """
    Parses the join string from the URL.

    Expected format: table_name,from_col:to_col;from_col:to_col

    :param join_str: The join= string from the URL
    :param outer_join: boolean, true if the join is an outer join, false for inner join.
    :return: TableJoin
    """
    # TODO: find a way to notify user of bad join. Should we just completely fail? Should we just warn them?

    if join_str is None:
        return None

    try:
        table_name, column_pair_strings = join_str.split(',')
    except ValueError:
        return None

    column_pair_strings = column_pair_strings.split(';')
    column_pairs = []

    for column_pair_string in column_pair_strings:
        from_column, to_column = column_pair_string.strip().split(':')
        column_pairs.append(ColumnPair(from_column, to_column))

    if len(column_pairs) == 0:
        return None

    return TableJoin(table_name, column_pairs, outer_join)


def parse_col_names(column_names):
    """
    This method takes a string of comma-seperated column names and returns a list of column names.

    :param column_names: string
    :return: column_names: list
    """
    if column_names:
        columns_dict = OrderedDict()

        for column_name in column_names.split(','):
            columns_dict[column_name.strip()] = True

        column_names = list(columns_dict.keys())

    return column_names

def parse_query_args(query_args):
    """
    This method takes the query string from the request and returns all of the items related to the query API.

    :param query_args: The query args from flask.request.args
    :return: column_names: list, page: int, per_page: int, filters: dict
    """
    page, per_page = parse_pagination(query_args.get('page'), query_args.get('perPage'))
    filters = parse_filters(query_args.getlist('filter'))
    sorts = parse_sorts(query_args.getlist('sort'))
    join = parse_join(query_args.get('join'), False) or parse_join(query_args.get('outerjoin'), True)
    column_names = parse_col_names(query_args.get('cols', None))
    group_by = parse_col_names(query_args.get('group_by', None))

    return column_names, page, per_page, filters, sorts, join, group_by


def table_not_found(name):
    code = 404
    error_title = "{}: Table Not Found".format(code)
    msg = 'A table with name "{}" could not be found.'.format(name)

    return render_template('error.html', code=code, error_title=error_title, msg=msg), code


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
        column_names, page, per_page, filters, sorts, join, group_by = parse_query_args(request.args)

        try:
            table_info = self.db_service.get_table(name)
        except NotFoundError as e:
            return jsonify(success=False, error=str(e)), 404

        try:
            rows, columns = self.db_service.query_table(name, column_names, page, per_page, filters, sorts, join, group_by)
        except JoinError as e:
            return jsonify(error=str(e)), 400

        return jsonify(table=table_info, rows=rows, columns=columns)

    query_api.methods = ['GET']

    def tables_page(self):
        tables = self.db_service.get_tables()

        return render_template('tables.html', tables=tables)

    tables_page.methods = ['GET']

    def table_page(self, name):
        column_names, page, per_page, filters, sorts, join, group_by = parse_query_args(request.args)

        try:
            table = self.db_service.get_table(name)
        except NotFoundError:
            return table_not_found(name)

        rows, columns = self.db_service.query_table(name, column_names, page, per_page, filters, sorts, join, group_by)
        title = "{} - Grice".format(name)

        return render_template('table.html', title=title, table=table, rows=rows, columns=columns, page=page + 1,
                               per_page=per_page)

    def chart_page(self, name):
        column_names, page, per_page, filters, sorts, join, group_by = parse_query_args(request.args)
        join_table = None

        try:
            table = self.db_service.get_table(name)
        except NotFoundError:
            return table_not_found(name)

        if join:
            try:
                join_table = self.db_service.get_table(join.table_name)
            except NotFoundError:
                # Bad join table name. Should probably warn the user, but ignoring for now.
                pass

        title = "{} - Charting - Grice".format(name)

        columns = table['columns']

        if join_table:
            columns = columns + join_table['columns']

        return render_template('chart.html', title=title, table=table, columns=columns)

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
        self.app.add_url_rule('/db/tables/<name>/chart', 'chart_page', self.chart_page)
