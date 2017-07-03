import logging
import sys
import os
import argparse
from grice.app import App

logging.basicConfig(
    stream=sys.stdout,
    format='%(asctime)s:%(levelname)s: %(message)s',
    level=os.environ.get('DEBUG_LEVEL') or logging.INFO)

def main():
    """
    TODO: parse args here
    :return:
    """
    parser = argparse.ArgumentParser(description='Grice')
    parser.add_argument('--config', help='The path to the config file', default='./config.ini')
    args = parser.parse_args()
    app = App(args.config)
    app.serve()


if __name__ == '__main__':
    main()
