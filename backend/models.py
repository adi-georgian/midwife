from pydantic import BaseModel


class AspectNode(BaseModel):
    id: str
    aspect: str
    question: str
    suggestions: list[str]
    answer: str | None = None
    children: list["AspectNode"] = []


class SessionState(BaseModel):
    session_id: str
    objective: str
    root: AspectNode

    def find_node(self, node_id: str) -> AspectNode | None:
        return self._find_node(self.root, node_id)

    def get_path_to_node(self, node_id: str) -> list[AspectNode] | None:
        return self._get_path_to_node(self.root, node_id)

    def _find_node(self, node: AspectNode, node_id: str) -> AspectNode | None:
        if node.id == node_id:
            return node
        for child in node.children:
            found = self._find_node(child, node_id)
            if found is not None:
                return found
        return None

    def _get_path_to_node(
        self, node: AspectNode, node_id: str
    ) -> list[AspectNode] | None:
        if node.id == node_id:
            return [node]
        for child in node.children:
            path = self._get_path_to_node(child, node_id)
            if path is not None:
                return [node] + path
        return None


# --- Request / Response schemas ---


class CreateSessionRequest(BaseModel):
    objective: str


class CreateSessionResponse(BaseModel):
    session_id: str
    aspects: list[AspectNode]


class AnswerRequest(BaseModel):
    answer: str


class ElaborateResponse(BaseModel):
    aspects: list[AspectNode]


class TreeResponse(BaseModel):
    session_id: str
    objective: str
    root: AspectNode
