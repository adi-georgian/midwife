from utils import visualize_tree
from components import Thesis, AntiThesis, Aspect

thesis = Thesis(OneLiner="Unicorns are real.")
anithesis = AntiThesis(OneLiner="Unicorns are not real.")
aspects = \
[
    Aspect(title='XYZ', content=aspect_content, parent=thesis) for aspect_content in 
    [
        "What do you define as 'real'?",
        "Can you support your claim with evidence or examples?",
    ]
]

visualize_tree(thesis)