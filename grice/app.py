import configparser

from grice.db_controller import DBController
from grice.db_service import DBService
from grice.errors import ConfigurationError
from flask import Flask
from waitress import serve


def _print_start_screen():
    print("                               u")
    print("    .                       u$$$$")
    print("   $$$$$$bu.             u$$$$$$$$")
    print("  9$$$$$$$$$$R$       z$$$$$$$$$$$k")
    print(" '$$$$$$$$$$!$        $X$$$$$$$$$$$")
    print(" 8$$$$$$$$MM!E    .u  'B!MM$$$$$$$$>")
    print(" $$$$$$$$MMMXE .d$#$k  $!MM$$$$$$$$E")
    print("'$$$$$$$8MWHX$  9WXX$ dRXXSM8$$$$$$E")
    print(" $$$$$$$$$$$$$$$@@$~tW@WWWWeeWeWWee")
    print(" 4$$$$$$MMHX!!!!!9F  4$!!HMM8$$$$$F")
    print("  R$$$$$$MMMX!!!!Xk   9B!MMN$$$$$$")
    print("   #$$$$$$MMMMHH!!&   '$MMM$$$$$$~")
    print('    `$$$$$$$8MMMM!$>   4$M$$$$$$"')
    print("      ^*$$$$$$$8MMX$   '$$$$$$$")
    print('         ^#R$$$$$$$$$i  $$$$$"')
    print('                        $$$"')


class App:
    def __init__(self, config_path):
        _print_start_screen()
        config = configparser.ConfigParser()
        config.read(config_path)

        self.host = config['server'].get('host', '0.0.0.0')
        self.port = config['server'].getint('port', 8080)
        self.threads = config['server'].getint('threads', 8)
        self.debug = config['server'].getboolean('debug', False)

        try:
            self.secret = config['server']['secret']
        except KeyError:
            raise ConfigurationError('Entry "secret" required in section "server"')

        self.flask_app = Flask('grice', '/assets/', './assets')
        self.flask_app.debug = self.debug
        self.flask_app.secret_key = self.secret
        self._db_service = DBService(config['database'])
        self._db_controller = DBController(self.flask_app, self._db_service)

    def serve(self):
        self.flask_app.logger.info('Starting server...')
        serve(self.flask_app, host=self.host, port=self.port, threads=self.threads)