# Literature review for Midwife: AI-partnered structured thinking through Socratic dialogue trees

**Midwife sits at a rich intersection of three active research streams**: AI-augmented sensemaking tools that move beyond flat chat, Socratic and dialectical AI interaction, and non-linear conversation interfaces rooted in decades of argumentation research. This review synthesizes **40+ papers** across these threads, drawn primarily from CHI, UIST, IUI, CSCW, and TOCHI (2022–2025), along with essential foundational works. Papers marked with ★ are **critical to cite** in a project proposal.

---

## Thread 1: AI-assisted sensemaking, planning, and structured thinking tools

This is Midwife's most directly relevant literature. A wave of systems published at UIST and CHI since 2022 tackle the fundamental limitation of linear chatbot interfaces for complex information work — precisely the design problem Midwife addresses.

**★ Sensecape: Enabling Multilevel Exploration and Sensemaking with Large Language Models**
Sangho Suh, Bryan Min, Srishti Palani, Haijun Xia · UIST 2023

Sensecape is the single closest precedent to Midwife's spatial, hierarchical approach. It provides an infinite canvas where users interact with an LLM through multilevel abstraction — switching fluidly between information foraging and sensemaking loops. A within-subjects study showed users explored **significantly more topics** and structured knowledge more effectively than with a ChatGPT+canvas baseline. Midwife extends this spatial paradigm by adding Socratic questioning and dialectical structure rather than purely informational hierarchy.

**★ Selenite: Scaffolding Online Sensemaking with Comprehensive Overviews Elicited from Large Language Models**
Michael Xieyang Liu, Tongshuang Wu, Tianying Chen, Franklin Mingzhe Li, Aniket Kittur, Brad A. Myers · CHI 2024

Selenite uses GPT-4 to generate structured overviews of options and criteria for unfamiliar decision domains, solving the "cold-start" problem in sensemaking. It then adapts as users read articles — contextualizing content, highlighting relevant criteria, and suggesting queries. Three studies demonstrated a **36% acceleration** in information processing and improved comprehension. Relevant to Midwife as a model for how LLMs can scaffold structured decision-making by providing upfront structure that evolves with the user's understanding.

**★ Towards Human-AI Deliberation: Design and Evaluation of LLM-Empowered Deliberative AI for AI-Assisted Decision-Making**
Shuai Ma, Qiaoyi Chen, Xinru Wang, Chengbo Zheng, Zhenhui Peng, Ming Yin, Xiaojuan Ma · CHI 2025

This paper introduces "Human-AI Deliberation" — a paradigm where AI engages users in **dimension-level opinion exchange, iterative discussion, and structured decision updates** rather than presenting static recommendations. The Deliberative AI architecture features an Intention Analyzer, Deliberation Facilitator, and Argument Evaluator. A user study found it outperforms traditional explainable AI in fostering appropriate reliance. This is arguably the closest conceptual relative to Midwife's core vision of AI as a deliberation partner.

**Graphologue: Exploring Large Language Model Responses with Interactive Diagrams**
Peiling Jiang, Jude Rayan, Steven P. Dow, Haijun Xia · UIST 2023

Converts LLM text responses into interactive node-link diagrams in real-time. Users manipulate diagram complexity, collapse branches, and submit context-specific follow-ups by clicking nodes. Demonstrates that graphical, non-linear dialogue with LLMs improves information parsing and exploration — a key interaction pattern for Midwife's tree-structured interface.

**Luminate: Structured Generation and Exploration of Design Space with Large Language Models for Human-AI Co-Creation**
Sangho Suh, Meng Chen, Bryan Min, Toby Jia-Jun Li, Haijun Xia · CHI 2024

Rather than generating single responses, Luminate first extracts key *dimensions* from a prompt, then generates responses spanning those dimensions to construct a navigable design space. A study with **14 professional writers** showed it prevents premature convergence and nurtures divergent thinking. Relevant to Midwife's goal of helping users explore multiple reasoning paths rather than fixating on a single line of thought.

**Synergi: A Mixed-Initiative System for Scholarly Synthesis and Sensemaking**
Hyeonsu B. Kang, Tongshuang Wu, Joseph Chee Chang, Aniket Kittur · UIST 2023

Combines citation graph analysis with LLMs for literature synthesis. Users highlight relevant text as "seeds," and Synergi expands these into structured hierarchies of research threads with synthesized labels grounded in real citation contexts. A strong example of **mixed-initiative sensemaking** where user-driven seeds meet AI-generated structure.

**Supporting Sensemaking of Large Language Model Outputs at Scale**
Katy Ilonka Gero, Chelse Swoopes, Ziwei Gu, Jonathan K. Kummerfeld, Elena L. Glassman · CHI 2024

Explores how to present tens to hundreds of LLM responses simultaneously at the "mesoscale." Introduces five features using novel text analysis algorithms to reveal patterns across outputs. A controlled study (n=24) confirmed these features make previously intractable sensemaking tasks feasible — relevant to Midwife's need to help users navigate multiple branches of reasoning.

**Fuse: In-Situ Sensemaking Support in the Browser**
Andrew Kuznetsov, Joseph Chee Chang, Nathan Hahn, Napol Rachatasumrit, et al. · UIST 2022

A browser extension that externalizes working memory through low-cost collection and lightweight card-based organization of web content. A **22-month public deployment** provided longitudinal insights into real-world information foraging. Foundational work on in-situ sensemaking tools and the tension between collection and organization that Midwife also navigates.

**Unakite: Scaffolding Developers' Decision-Making Using the Web**
Michael Xieyang Liu, Jane Hsieh, Nathan Hahn, et al. · UIST 2019

Helps users capture and organize trade-off information into structured comparison tables when making complex decisions from web sources. Reduced information capture cost by **45%** and sped up subsequent understanding by ~3×. An important precursor showing how structured representations (options × criteria) can scaffold decision-making — the same pattern Midwife applies to deliberative dialogue.

**ChainForge: A Visual Toolkit for Prompt Engineering and LLM Hypothesis Testing**
Ian Arawjo, Chelse Swoopes, Priyan Vaithilingam, Martin Wattenberg, Elena L. Glassman · CHI 2024 (Honorable Mention)

An open-source visual programming toolkit for evaluating LLM responses across models and prompt variations. Demonstrates how node-link dataflow interfaces can make LLM interaction systematic and transparent. Relevant as a model for visual, structured LLM interaction beyond linear chat.

**CoNotate: Suggesting Queries Based on Notes Promotes Knowledge Discovery**
Srishti Palani, Zijian Ding, Austin Nguyen, Andrew Chuang, Stephen MacNeil, Steven P. Dow · CHI 2021

Analyzes users' notes and search history to recommend contextually relevant queries that fill knowledge gaps. Users issued significantly more queries and discovered more domain-specific terminology. An early example of using user-generated artifacts to drive AI-assisted exploration — analogous to how Midwife's dialogue tree could inform AI questioning.

---

## Thread 2: Socratic and dialectical methods with LLMs

This thread provides the theoretical and empirical backbone for Midwife's core interaction paradigm: AI that questions rather than answers, challenges rather than confirms, and scaffolds critical thinking rather than replacing it.

**★ Debate Chatbots to Facilitate Critical Thinking on YouTube: Social Identity and Conversational Style Make A Difference**
Thitaree Tanprasert, David Okundaye, Anthony J. Perritano, Ricarose Roque · CHI 2024 (Best Paper Award)

Investigates LLM-powered debate chatbots that challenge users' stances formed from YouTube videos. The study found that chatbots with **outgroup identity and persuasive rhetoric** most effectively induced critical thinking (interpretation, analysis, self-regulation). A landmark empirical result directly relevant to Midwife's design — demonstrating that AI persona and rhetorical strategy significantly affect how well AI-mediated debate promotes re-examination of one's own arguments.

**★ Enhancing AI-Assisted Group Decision Making through LLM-Powered Devil's Advocate**
Chun-Wei Chiang, Zhuoran Lu, Zhuoyan Li, Ming Yin · IUI 2024

Tests four devil's advocate variants (varying interactivity and objection target) in AI-assisted group decisions. Interactive devils' advocates that challenge AI recommendations **significantly improved appropriate reliance** and decision accuracy by catalyzing extended discussion. Provides a rigorous empirical framework for how AI can productively challenge assumptions — the core mechanism Midwife deploys through Socratic questioning.

**★ Iffy-Or-Not: Critically Evaluating Potential Misinformation with Fallacy Detection and Socratic Questioning Using LLMs**
Gionnieve Lim, Juho Kim, Simon Perrault · ACM TOCHI 2026

A browser extension combining LLM-powered fallacy highlighting, diverse search query suggestions, and Socratic questions for deeper reflection. A user study (N=18) found it encourages attentiveness and poses thought-provoking questions. Directly demonstrates a practical system combining **argumentation theory with Socratic AI questioning** — closely aligned with Midwife's approach to scaffolding critical evaluation.

**The Impact of Generative AI on Critical Thinking: Self-Reported Reductions in Cognitive Effort and Confidence Effects**
Hao-Ping (Hank) Lee, Advait Sarkar, Lev Tankelevitch, et al. · CHI 2025

Surveys 319 knowledge workers with 936 real-world GenAI examples. Finds that **higher AI confidence correlates with less critical thinking**, while higher self-confidence correlates with more. Identifies a shift from production to "critical integration" of AI output. Provides the empirical motivation for why systems like Midwife are needed — AI that promotes engagement rather than passive consumption.

**Breaking Barriers or Building Dependency? Exploring Team-LLM Collaboration in AI-infused Classroom Debate**
Zihan Zhang, Black Sun, Pengcheng An · CHI 2025

Studies ChatGPT integration in real-time classroom debates (22 students, 4 weeks). Identifies benefits (reduced social anxiety, scaffolding for novices) alongside risks (**information overload, cognitive dependency**). Essential reading for Midwife's design — highlights the tension between AI support and user autonomy in dialectical contexts.

**SocraticLM: Exploring Socratic Personalized Teaching with Large Language Models**
Jiayu Liu et al. · NeurIPS 2024

Fine-tunes LLMs for Socratic "thought-provoking" teaching using a Dean-Teacher-Student multi-agent pipeline. The resulting SocraTeach dataset contains **35K Socratic multi-round dialogues** across six cognitive student states. Demonstrates the feasibility of training LLMs to ask guiding questions rather than give answers — validates Midwife's core interaction paradigm at scale.

**The Art of Socratic Questioning: Recursive Thinking with Large Language Models**
Jingyuan Qi et al. · EMNLP 2023

Proposes a divide-and-conquer prompting algorithm mimicking recursive Socratic sub-questioning. Outperforms Chain-of-Thought and Tree-of-Thought on reasoning benchmarks. While focused on LLM reasoning rather than HCI, it demonstrates how **Socratic sub-questioning creates branching reasoning paths** — structurally analogous to Midwife's dialogue tree.

**Prompting Large Language Models With the Socratic Method**
Edward Y. Chang · arXiv 2023 (Stanford)

Engineers ten Socratic strategies from Plato's dialogues (elenchus, maieutics, dialectic, counterfactual reasoning, etc.) into prompt templates. Shows Socratic prompting improves output correctness and stimulates more critically examined responses. Provides a **practical taxonomy of Socratic questioning strategies** directly applicable to Midwife's AI questioning engine.

**AI-Driven Mediation Strategies for Audience Depolarisation in Online Debates**
CHI 2024

Tests AI mediator-bots using conflict resolution strategies (Collaborative, Compromising, Forceful) to reduce polarization. Found different strategies differentially affect perceived argument strength and consensus. Relevant to Midwife's design of AI as a dialectical mediator that provokes constructive introspection rather than taking sides.

**Building Machines that Learn and Think with People**
Katherine M. Collins, Ilia Sucholutsky, Umang Bhatt, et al. · Nature Human Behaviour 2024

A Perspective paper proposing AI as **"thought partners"** — systems designed to be reasonable, insightful, and trustworthy collaborators that think *with* humans. Lays out modes of collaborative thought (sensemaking, deliberation, ideation) using a Bayesian framework. Provides theoretical grounding for Midwife's vision of AI as a thinking partner rather than an answer machine.

---

## Thread 3: Non-linear and tree-structured conversation interfaces

This thread spans from foundational argument mapping work in the 1970s through to the current wave of systems that challenge the dominance of linear chat. Together, these papers establish both the theoretical warrant and practical design vocabulary for Midwife's tree-structured interface.

**★ VISAR: A Human-AI Argumentative Writing Assistant with Visual Programming and Rapid Draft Prototyping**
Zheng Zhang, Jie Gao, Ranjodh Singh Dhaliwal, Toby Jia-Jun Li · UIST 2023

VISAR supports argumentative writing through hierarchical goal brainstorming, **visual programming of tree-structured argument outlines**, and LLM-powered argumentation "sparks" (counterarguments, evidence, logical weakness detection). Grounded in Toulmin's model. Among the most directly relevant systems to Midwife — it combines tree-structured argument visualization with AI-powered dialectical support in a single interface.

**★ AMQuestioner: Training Critical Thinking with Question-Driven Interactive Argument Maps in Online Discussion**
Qiyu Pan et al. · CSCW 2025

Automatically extracts argument maps from Reddit (ChangeMyView) threads using GPT-4, then lets users explore claims via chatbot-suggested questions and critical thinking exercises. A mixed-design study (N=24) showed **improved critical thinking skills and open-mindedness**. This is perhaps the single most closely aligned system to Midwife — it combines argument mapping with AI-driven Socratic questioning in a structured visual interface.

**Evaluating Node-tree Interfaces for AI Explainability**
Lifei Wang et al. · arXiv 2025

Compares node-tree interfaces against traditional chatbot interfaces across task types. Found tree interfaces **excelled in decision-making and brainstorming tasks** while chatbots were better for linear step-by-step tasks. 90% of node-tree users found the interface easy to navigate. Provides direct empirical evidence supporting Midwife's tree-structured approach for exploratory thinking tasks.

**AI Threads: Conversational AI for Visualizing Multidimensional Datasets**
Matt-Heun Hong et al. · arXiv 2023

Develops a multi-threaded analytic chatbot for data visualization, finding that single-threaded LLM chatbots fall short for progressive refinement tasks. Evaluates multi-threaded conversation management through a crowdsourced study (n=40) and expert interviews (n=10). Demonstrates that **thread management is a critical design dimension** for complex analytical LLM interactions.

**Context Branching for LLM Conversations: A Version Control Approach**
Glanzz et al. · arXiv 2025

Formalizes conversation branching through version-control primitives: checkpoint, branch, switch, and inject. Experiments showed branching improved response quality by **28.7%** and reduced context size by 58.1%. Provides computational foundations for the branching mechanisms Midwife would need to implement.

**ABScribe: Rapid Exploration & Organization of Multiple Writing Variations in Human-AI Co-Writing Tasks**
Mohi Reza, Nathan Laundry, Ilya Musabirov, et al. · CHI 2024

Introduces "Variation Fields" that let writers maintain multiple text versions inline, with AI-generated alternatives. Reduced writer workload significantly (d=1.20, p<0.001). While focused on writing, the core pattern of **exploring parallel variations within a structured interface** directly informs Midwife's branching dialogue design.

**Cells, Generators, and Lenses: Design Framework for Object-Oriented Interaction with Large Language Models**
Tae Soo Kim, Yoonjoo Lee, Minsuk Chang, Juho Kim · UIST 2023

Decomposes LLM interaction into three interactive objects: Cells (input units), Generators (model instances), and Lenses (output views). Users create variations, recombine, and compare in parallel. Provides a **design vocabulary** for modular, non-linear LLM interaction that could inform Midwife's node-level interaction design.

**Patchview: LLM-Powered Worldbuilding with Generative Dust and Magnet Visualization**
John Joon Young Chung, Max Kreminski · UIST 2024

Uses a "dust and magnet" spatial metaphor where generated elements are positioned relative to user-defined concepts. Supports sensemaking and steering of generation through spatial positioning. A creative example of **spatial interfaces for navigating AI-generated content** — relevant to Midwife's spatial tree layout.

---

## Foundational works every proposal should reference

These seminal papers provide the theoretical scaffolding for Midwife's design. They establish the intellectual lineage that connects structured argumentation, sensemaking theory, and mixed-initiative interaction to Midwife's specific contribution.

**★ IBIS: Issues as Elements of Information Systems**
Werner Kunz, Horst Rittel · 1970 · UC Berkeley Working Paper

Defined the Issue-Based Information System with three node types — **Issues (questions), Positions (answers), and Arguments (pros/cons)** — connected by typed relationships. IBIS's structured conversation grammar is the direct ancestor of Midwife's tree-structured Socratic dialogue. Every argument mapping and dialogue mapping system since traces back to this work.

**★ Principles of Mixed-Initiative User Interfaces**
Eric Horvitz · CHI 1999

Established **12 design principles** for coupling automated AI services with direct user manipulation: scoping precision to uncertainty, providing safety nets, timing interventions appropriately. Essential for Midwife's design of when the AI should proactively question versus passively respond — the fundamental mixed-initiative tension in any AI thinking partner.

**★ Toulmin, S. E. *The Uses of Argument***
Stephen Toulmin · 1958 · Cambridge University Press

Proposed the six-component argument model (claim, grounds, warrant, backing, qualifier, rebuttal) that underpins virtually all computational argumentation work. Each node in Midwife's dialogue tree could map to a **Toulmin element**, providing the structural grammar for how arguments are decomposed and evaluated.

**★ Dilemmas in a General Theory of Planning (Wicked Problems)**
Horst Rittel, Melvin Webber · Policy Sciences, 1973

Introduced "wicked problems" — ill-structured problems with no definitive formulation, no stopping rule, and no true/false solutions. Argued that such problems demand **argumentative, deliberative processes**. Provides the foundational motivation for why tools like Midwife exist: complex thinking requires structured dialogue, not algorithmic solutions.

**gIBIS: A Hypertext Tool for Exploratory Policy Discussion**
Jeff Conklin, Michael Begeman · CSCW 1988 / ACM TOIS

First major graphical implementation of IBIS as a hypertext system with color-coded node types and structured relationships. Demonstrated that **eliminating unconstructive conversational moves** through typed structure improves policy discussion quality. The direct predecessor to Compendium and modern argument mapping tools.

**Compendium: Dialogue Mapping Software**
Al Selvin, Simon Buckingham Shum, Jeff Conklin, et al. · ~2001–2006

The most fully realized IBIS tool, featuring typed nodes (questions, ideas, pros, cons, decisions) with real-time collaborative mapping. Used the "Dialogue Mapping" facilitation technique. Midwife can be understood as an **AI-augmented successor to Compendium** — where the AI replaces the human facilitator in structuring group reasoning.

**Questions, Options, and Criteria: Elements of Design Space Analysis (QOC)**
Allan MacLean, Richard Young, Victoria Bellotti, Thomas Moran · Human-Computer Interaction, 1991

Introduced QOC notation for design rationale: Questions identify issues, Options provide answers, Criteria evaluate them. The branching QOC structure (questions → options → criteria) is **structurally isomorphic** to Midwife's dialogue tree and demonstrates how externalized deliberation supports communication and future redesign.

**The Cost Structure of Sensemaking**
Daniel Russell, Mark Stefik, Peter Pirolli, Stuart Card · CHI 1993

Defines sensemaking as searching for a representation and encoding data into it. The "learning loop complex" of generation, data coverage, and representation shift loops explains **why Midwife's tree structure helps** — it provides an explicit representation that reduces the cognitive cost of organizing complex thoughts.

**The Sensemaking Process and Leverage Points for Analyst Technology**
Peter Pirolli, Stuart Card · 2005

Extended Russell et al.'s model into the dual-loop foraging-sensemaking framework and identified specific **technological leverage points** — places where tools can most effectively support analysts. Midwife's Socratic questioning maps directly to leverage points in the sensemaking loop where prompts help users restructure schemas.

**Information Foraging**
Peter Pirolli, Stuart Card · Psychological Review, 1999

Applied optimal foraging theory to information-seeking, explaining how users follow "information scent" to navigate information spaces. Relevant because Midwife's tree branches create **scent cues** that guide users toward productive reasoning paths, and the AI can strengthen these cues through strategic questioning.

**Visualizing Argumentation: Software Tools for Collaborative and Educational Sense-Making**
Paul Kirschner, Simon Buckingham Shum, Chad Carr (Eds.) · Springer, 2003

Comprehensive volume on Computer Supported Argument Visualization covering dialogue mapping, IBIS tools, and educational applications. Represents the **prior generation of structured argumentation tools** that Midwife augments with LLM capabilities.

**Cognition in the Wild (Distributed Cognition)**
Edwin Hutchins · MIT Press, 1995

Argues cognitive processes are distributed across people, artifacts, and environments. Midwife creates a **distributed cognitive system** where thinking is spread across the user, the AI, and the externalized dialogue tree — each component contributing capabilities the others lack.

**The Reflective Practitioner**
Donald Schön · Basic Books, 1983

Describes "reflection-in-action" — how professionals reframe problems through a reflective conversation with the situation. Midwife's Socratic questioning is designed to prompt exactly this kind of reflective reframing, making **Schön's implicit reflective dialogue explicit and structured**.

**The Role of Tutoring in Problem Solving (Scaffolding)**
David Wood, Jerome Bruner, Gail Ross · Journal of Child Psychology and Psychiatry, 1976

Introduced "scaffolding" — temporary support enabling learners to accomplish tasks beyond unassisted ability. Identifies six scaffolding functions (recruitment, direction maintenance, marking critical features, etc.). Midwife's AI partner functions as a **scaffolding agent** whose Socratic questioning is calibrated to the user's current thinking level.

---

## Additional relevant works bridging these threads

Several recent papers sit at the intersection of multiple threads and illuminate additional design dimensions for Midwife.

**CoQuest: How AI Processing Delays Foster Creativity in Research Question Co-Creation**
Yiren Liu, Si Chen, Haocong Cheng, et al. · CHI 2024

Demonstrates that AI processing delays can actually foster deeper creative thinking by giving users reflection time. Relevant to Midwife's pacing design — **strategic pauses in Socratic questioning** may be more productive than instant responses.

**AI-Augmented Brainwriting: Investigating the Use of LLMs in Group Ideation**
Orit Shaer, Angelora Cooper, Osnat Mokryn, Andrew L. Kun, Hagit Ben Shoshan · CHI 2024

Integrates LLMs into both divergent and convergent ideation phases with structured evaluation. Shows AI can support **evaluation and synthesis, not just generation** — the same balance Midwife strikes between producing ideas and critically examining them.

**Shaping Human-AI Collaboration: Varied Scaffolding Levels in Co-writing with Language Models**
Bhat et al. · CHI 2024

Finds that expertise moderates the effectiveness of different AI scaffolding levels — novices benefit from high-level support while experts prefer low-level. Directly informs how Midwife should **adapt its Socratic questioning depth** based on user expertise.

**Tree of Thoughts: Deliberate Problem Solving with Large Language Models**
Shunyu Yao, Dian Yu, Jeffrey Zhao, et al. · NeurIPS 2023

Generalizes chain-of-thought prompting by maintaining a tree of reasoning paths with self-evaluation and backtracking. Structurally analogous to Midwife — **both represent branching deliberation** — but Tree of Thoughts is purely computational while Midwife is a human-facing interface for the same pattern.

**Exploring the Potential of Large Language Models in Computational Argumentation**
Guizhen Chen, Liying Cheng, Anh Tuan Luu, Lidong Bing · ACL 2024

Comprehensive assessment of LLM argumentation capabilities across 14 datasets and six task categories. Demonstrates that modern LLMs have **commendable argumentation abilities** that Midwife can leverage for generating counterarguments, detecting logical weaknesses, and structuring debates.

**Cocoa: Co-Planning and Co-Execution with AI Agents**
K. J. Kevin Feng, Daniel S. Weld, Amy X. Zhang, et al. · CHI 2026

A computational-notebook-inspired system for human-AI co-planning and co-execution of research tasks. Users collaboratively compose plans with an AI agent and jointly execute steps. Relevant to Midwife's planning dimension — demonstrates how **structured co-planning interfaces** can support complex task decomposition.

**A Design Space for Intelligent and Interactive Writing Assistants**
Mina Lee, Katy Ilonka Gero, John Joon Young Chung, et al. · CHI 2024

Proposes a design space structured around five aspects (task, user, technology, interaction, ecosystem) based on 115 papers. Provides a **shared vocabulary** for positioning Midwife within the broader landscape of intelligent assistive tools and arguing for its specific design choices.

---

## How to position Midwife in this landscape

The literature reveals a clear gap that Midwife fills. Existing systems tend to address **one or two** of the following, but no current system integrates all three:

- **Structured sensemaking with AI** (Sensecape, Selenite, Luminate) — these systems help users organize information but do not engage in dialectical questioning or challenge the user's reasoning
- **Socratic/dialectical AI interaction** (debate chatbots, devil's advocate systems, SocraticLM) — these systems question and challenge users but operate within flat, linear chat interfaces
- **Non-linear conversation structure** (IBIS/gIBIS, Compendium, AMQuestioner, VISAR) — these provide tree or graph structures for argumentation but either lack AI integration or use AI only for content generation rather than Socratic facilitation

Midwife's contribution is the **synthesis**: a tree-structured dialogue interface where AI acts as a Socratic interlocutor — combining the spatial structure of Sensecape, the dialectical engagement of Human-AI Deliberation, and the argumentation grammar of IBIS. The theoretical warrant comes from Horvitz's mixed-initiative principles (when to question vs. support), Toulmin's argument model (how to structure nodes), Pirolli and Card's sensemaking loops (why structure aids cognition), and Wood et al.'s scaffolding framework (how to calibrate AI support). The most critical papers for a proposal are those marked ★ above, particularly Sensecape, Human-AI Deliberation, the CHI 2024 Debate Chatbots paper, VISAR, AMQuestioner, and the IBIS/Toulmin/Horvitz foundational triad.