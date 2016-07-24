from decimal import Decimal

from flask.json import JSONEncoder


class ColumnEncoder(JSONEncoder):
    """
    This encoder is required in order for us to serialize "real" column types from SQLAlchemy. We will likely need to
    add support for more columns later.
    """
    def default(self, obj):
        try:
            if isinstance(obj, Decimal):
                return float(obj)

            iterable = iter(obj)
        except TypeError:
            pass
        else:
            return list(iterable)

        return JSONEncoder.default(self, obj)
