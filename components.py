from utils import summarize_aspect

class Thesis:
    """
        - The central Idea of the Discourse
        - Root node of the Discourse Tree
    """
    def __init__(self, label: str = None, content: str = None):
        # Unique Identifier
        self.thesis_id = id(self)
        # Short Label
        self.thesis_label = label if label else summarize_aspect(content)
        # Main Idea of the Thesis
        self.thesis_content = content
        # Aspects of this Thesis
        self.thesis_aspects = []

    def add_aspect(self, child_aspect: str):
        self.thesis_aspects.append(
            Aspect(
                label=summarize_aspect(child_aspect),
                content=child_aspect,
                aspect_of=self
            )
        )
    
    def get_aspect(self, target_aspect: str):
        for aspect in self.thesis_aspects:
            if aspect.aspect_content == target_aspect:
                return aspect
        
        raise ValueError('Thesis does not have this Aspect')

class Aspect:
    """
        - One aspect of the central Idea (or of other Aspects within the Central Idea)
        - One node within the Discourse Tree
    """
    def __init__(self, label, content, aspect_of):
        # Unique Identifier
        self.aspect_id = id(self)
        # Short Label
        self.aspect_label = label
        # Main Idea of the Aspect
        self.aspect_content = content
        # Aspect of what Thesis / other Aspect
        self.aspect_of = aspect_of
        # Aspects of this Aspect
        self.aspect_children = []

    def add_aspect(self, child_aspect: str):
        self.aspect_children.append(
            Aspect(
                label=summarize_aspect(child_aspect),
                content=child_aspect,
                aspect_of=self
            )
        )
    
    def get_aspect(self, target_aspect: str):
        for aspect in self.thesis_aspects:
            if aspect.aspect_content == target_aspect:
                return aspect
        
        raise ValueError('Thesis does not have this Aspect')