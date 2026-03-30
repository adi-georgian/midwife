from pydantic import BaseModel


class AspectNode(BaseModel):
    id: str
    aspect: str
    question: str
    summary: str = ""
    importance: float = 0.5
    suggestions: list[str]
    answer: str | None = None
    description: str | None = None
    is_ghost: bool = False
    children: list["AspectNode"] = []


class UpdateAspectRequest(BaseModel):
    aspect: str | None = None
    answer: str | None = None
    question: str | None = None


class SessionState(BaseModel):
    session_id: str
    objective: str
    mode: str = ""
    background: dict = {}
    root: AspectNode
    discourse_name: str = ""

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

    def find_parent(self, node_id: str) -> AspectNode | None:
        return self._find_parent(self.root, node_id)

    def _find_parent(self, node: AspectNode, node_id: str) -> AspectNode | None:
        for child in node.children:
            if child.id == node_id:
                return node
            found = self._find_parent(child, node_id)
            if found is not None:
                return found
        return None


# --- Request / Response schemas ---


class CreateSessionRequest(BaseModel):
    objective: str
    mode: str = ""          # e.g. "logistics", "brainstorming", "creative", "problem_solving", "decision", "research"
    help_level: str = ""
    prior_knowledge: str = ""
    already_planned: str = ""
    constraints: str = ""
    knowledge_level: str = ""
    extra_context: str = ""


class CreateSessionResponse(BaseModel):
    session_id: str
    aspects: list[AspectNode]
    discourse_name: str


class AnswerRequest(BaseModel):
    answer: str
    description: str | None = None


class ElaborateResponse(BaseModel):
    aspects: list[AspectNode]


class TreeResponse(BaseModel):
    session_id: str
    objective: str
    root: AspectNode


class PrefetchRequest(BaseModel):
    aspect_ids: list[str]


class PrefetchResponse(BaseModel):
    status: str


class RevealResponse(BaseModel):
    children: list[AspectNode]


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class PanelTab(BaseModel):
    id: str
    title: str
    content: str


class GeneratePanelRequest(BaseModel):
    existing_plan: str | None = None


class GeneratePanelResponse(BaseModel):
    tabs: list[PanelTab] = []
    plan_patches: list | None = None


class TabContext(BaseModel):
    tab_id: str
    tab_title: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    aspect_context: dict | None = None  # {aspect, question, summary}
    tab_context: TabContext | None = None


class LabelChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    reply: str
    suggested_answer: str | None = None
    suggested_answers: list[str] = []
    updated_aspect: str | None = None
    updated_question: str | None = None
    updated_tab: PanelTab | None = None
    plan_patches: list | None = None


class AddAspectRequest(BaseModel):
    aspect: str
    question: str = ""
    suggestions: list[str] = []
    generate: bool = False


class MoveAspectRequest(BaseModel):
    new_parent_id: str


class GenerateAspectsRequest(BaseModel):
    label: str
    details: str = ""


class RecontextualizeResponse(BaseModel):
    updated_ancestors: list[dict] = []
    spinoff_suggestions: list[dict] = []


class AspectContext(BaseModel):
    aspect_name: str
    rationale: str


class BriefingAspect(BaseModel):
    id: str
    aspect: str
    question: str
    rationale: str


class BriefingResponse(BaseModel):
    overview_prose: str
    aspect_rationales: list[AspectContext]


class BriefingChatRequest(BaseModel):
    message: str
    page: str  # "overview"
    current_overview: str | None = None
    current_ideas: list[dict] | None = None
    current_questions: list[dict] | None = None


class BriefingChatResponse(BaseModel):
    acknowledgment: str
    updated_overview: str | None = None
    updated_ideas: None = None
    updated_questions: None = None


class BriefingCycleResponse(BaseModel):
    aspects: list[BriefingAspect]
