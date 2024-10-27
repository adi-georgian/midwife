import graphviz
from components import Thesis

def build_tree(thesis: Thesis):
    g = graphviz.Digraph()
    g.node(str(thesis.AspectTitle))

    def traverse(node):
        for child in node.AspectChildren:
            g.node(str(child.AspectTitle))
            g.edge(str(node.AspectTitle), str(child.AspectTitle))
            traverse(child)

    traverse(thesis)
    return g

def summarize_aspect(aspect_content):
    mapping = {
        "What do you define as 'real'?" : "Definition of Real?",
        "Can you support your claim with evidence or examples?" : "Supporting Evidence?",
        "Is 'real' defined as perceptible?" : "Defined as perceptible?",
        "Can what is 'real' be different for two people?" : "Can differ for two people?",
        "Is it not impossible to prove non-existence" : "Impossible to prove negative?",
        "Why do we need empirical examples?" : "Why empiricism?"
    }

    return mapping[aspect_content]