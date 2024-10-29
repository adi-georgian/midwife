from visualize import build_tree
from components import Thesis, Aspect

if __name__ == "__main__":
    thesis = Thesis(content="Unicorns are real.")

    aspects = \
    [
        "What do you define as 'real'?",
        "Can you support your claim with evidence or examples?",
    ]

    for aspect in aspects:
        thesis.add_aspect(aspect)

    aspects = \
    [
        "Is 'real' defined as perceptible?",
        "Can what is 'real' be different for two people?",
    ]

    for aspect in aspects:
        thesis.get_aspect("What do you define as 'real'?").add_aspect(aspect)

    aspects = \
    [
        "Is it not impossible to prove non-existence",
        "Why do we need empirical examples?",
    ]

    for aspect in aspects:
        thesis.get_aspect("Can you support your claim with evidence or examples?").add_aspect(aspect)

    tree = build_tree(thesis)