import logging
from collections import namedtuple
from typing import List, Union
from sqlalchemy import Table, Column, not_, or_, and_
from sqlalchemy import func as sql_func

log = logging.getLogger(__name__)  # pylint: disable=C0103

LIST_FILTERS = ['in', 'not_in', 'bt', 'nbt']
FILTER_TYPES = ['lt', 'lte', 'eq', 'neq', 'gt', 'gte'] + LIST_FILTERS

ColumnFunction = namedtuple('ColumnFunction', ['table_name', 'column_name', 'func_name', 'operator_name', 'operator_value'])


def _get_column(table_name: str, column_name: str, tables: List[Table]) -> Column:
    if table_name:
        for table in tables:
            if table_name == table.name:
                return table.columns.get(column_name, None)
        return None
    return tables[0].columns.get(column_name, None)

def get_column(column_name: str, tables: List[Table]):
    """
    Converts a column name to a column object.

    :param column_name: str, column_name strings, can be None.
    :param table: The main table.
    :param join_table: The table we are joining on, can be None.
    :return: SqlAlchemy column object.
    """

    if isinstance(column_name, ColumnFunction):
        func_name = column_name.func_name
        table_name = column_name.table_name
        operator_name = column_name.operator_name
        operator_value = column_name.operator_value
        column_name = column_name.column_name

    else:
        func_name = None
        table_name = None
        operator_name = None

        try:
            column_name, table_name = column_name.split('.')
        except ValueError:
            # This is fine, this means that this isn't a fully qualified column name.
            pass

    column = _get_column(table_name, column_name, tables)

    if operator_name:
        column = column.op(operator_name)(operator_value)

    if func_name:
        return getattr(sql_func, func_name)(column)

    return column

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

def convert_url_value(url_value: str, column: Column):
    """
    Converts a given string value to the given Column's type.

    :param url_value: a string
    :param column: a sqlalchemy Column object
    :return: value converted to type in column object.
    """
    if column.type.python_type == bool:
        return url_value.lower() == 'true'
    return column.type.python_type(url_value)


class ColumnFilter:  # pylint: disable=too-few-public-methods
    def __init__(self, column_name: str, filter_type: str, value=None, url_value=None, column: Column = None):  # pylint: disable=too-many-arguments
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
    def column(self) -> Column:
        return self._column

    @column.setter
    def column(self, column: Column):
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
            raise ValueError('Invalid value "{}" for type "{}"'.format(self.url_value, column.type.python_type))

        self._column = column

    def _get_expression(self, column: Column):  # pylint: disable=too-many-return-statements
        """
        Given a Column and ColumnFilter return an expression to use as a filter.
        :param column: sqlalchemy Column object
        :param column_filter: ColumnFilter object
        :return: sqlalchemy expression object
        """
        try:
            self.column = column
        except ValueError:
            # Ignore bad filters.
            return None

        value = self.value
        filter_type = self.filter_type

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

    def get_expression(self, tables: List[Table]):
        """
        Given a Column and a list of ColumnFilters return a filter expression.

        :param table: The main table.
        :param join_table: The table we are joining on, can be None.
        :return: list of sqlalchemy expression objects
        """
        column = get_column(self.column_name, tables)
        expr = self._get_expression(column)
        return expr

class ComplexFilter:  # pylint: disable=too-few-public-methods

    def __init__(self, list_of_filters: List[Union['ComplexFilter', ColumnFilter]], is_and: bool = True):
        self.list_of_filters = list_of_filters
        self.expression_fn = and_ if is_and else or_

    def get_expression(self, tables: List[Table]):
        """
        Given a Column and a list of ColumnFilters return a filter expression.

        :param table: The main table.
        :param join_table: The table we are joining on, can be None.
        :return: list of sqlalchemy expression objects
        """
        if self.list_of_filters:
            expressions = (f.get_expression(tables) for f in self.list_of_filters)
            expressions = [e for e in expressions if not None]
            if expressions:
                number_of_filters = len(expressions)
                if number_of_filters == 1:
                    return expressions[0]
                return self.expression_fn(e for e in expressions)
