class Aspect:
    def __init__(self, title, content, parent, index=None):
        self.AspectIndex = index
        self.AspectTitle = title
        self.AspectContent = content
        self.AspectChildren = []
        self.AspectParent = parent

        # If Aspect is not the Thesis itself
        if parent:
            # Link this child Aspect to parent Aspect
            parent.add_child_aspects(self)
            # Initialize child Aspect's index wrt parent Aspect
            self.AspectIndex = self.AspectParent.AspectIndex + 1

    def add_child_aspects(self, child):
        self.AspectChildren.append(child)

class Thesis(Aspect):
    """
        The Thesis is the main Aspect.
    """
    def __init__(self, OneLiner: str):
        super().__init__(
            index=1,
            title="Thesis",
            content=OneLiner,
            parent=None
        )

class AntiThesis(Aspect):
    """
        The AntiThesis is the logical opposite of the main Aspect.
    """
    def __init__(self, OneLiner: str):
        super().__init__(
            index=-1,
            title="AntiThesis",
            content=OneLiner,
            parent=None
        )