


def train():
    # NEEDS DEFINITION


if __name__ == '__main__':
    try:
        train()
    except (ValueError, OSError) as error:
        raise SystemExit(str(error)) from None
