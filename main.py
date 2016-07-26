import argparse

from grice.app import App


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
