import graphviz
from components import Thesis, Aspect

def build_tree(thesis: Thesis):
    g = graphviz.Digraph()
    g.node(str(thesis.thesis_label))

    def traverse(node: Thesis | Aspect):
        for child in node.aspect_children if isinstance(node, Aspect) else node.thesis_aspects:
            g.node(str(child.aspect_label))
            g.edge(
                str(node.aspect_label) if isinstance(node, Aspect) else str(node.thesis_label),
                str(child.aspect_label)
            )
            traverse(child)

    traverse(thesis)
    return g
