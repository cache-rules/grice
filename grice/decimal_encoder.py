from decimal import Decimal

from flask.json import JSONEncoder


class DecimalEncoder(JSONEncoder):
    """
    This encoder is required in order for us to serialize "real" column types.
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
