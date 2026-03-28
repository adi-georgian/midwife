# Course Project: Midwife

I propose Midwife: a platform for enabling users to engage in structured thinking, planning, and debating, in partnership with an AI chatbot. The objective is to help users birth new ideas, using elements from the Socratic Method for reasoning, sensemaking and structured debate.

# Planned Usage Model

The role of the LLM-powered chatbot would be to act as a Socratic interlocutor / thinking partner: a User provides an initial "Thesis": this could be an idea, a proposition, or even an opinion. They may also provide a general framing or premise for their Thesis.

Then, the User will engage in a multi-turn interaction with the Midwife chatbot to flesh out this original Thesis. Concretely, Midwife will provide exactly five "Aspects" pertaining to the Thesis; each being a relevant component that warrants discussion.

The User may specify which Aspects they truly deem relevant and worth exploring, and may thus choose to "disregard" the others (these may still be tracked for later consideration). From the ones relevant, the User may click on one Aspect, and prompt Midwife further with their thoughts on that Aspect of the Thesis.

This will in turn trigger the same process of producing 5 new aspects based on the User's words, soon leading to a "Discourse": a tree of conversation.

# What problem is Midwife solving?

- Modern-day LLMs are becoming increasingly adept at engaging in intellectual sparring, often helping users formalize their thinking, flesh out new ideas, and even find holes in their thought processes.
- This includes conversations that may be broad-scope vs small-scope, theoretical vs logistical, complex vs trivial. A few examples could be:
    - planning an event
    - buying a new car
    - learning a complex skill
    - moving to a new country
    - making crucial life decisions
    - academics: testing hypotheses, debating propositions, etc.

# The pain point:
- most LLM platforms are restricted to 1-dimensional, scrollable chat interfaces that can't adjust according to the scope of the conversation.
- It may be possible to group conversations within more abstract "projects", but not to map out or navigate a project in any modality other than chats.
- Midwife could allow Users a canvas for thinking, as well as arranging their thoughts.
- The singular goal of Midwife is to encourage critical thinking, leveraging AI to achieve this.
- The broader research questions:
    - Can we find a way to model Human-AI interaction as a Socratic dialogue?
    - Can we capture this in a dynamic, tree-style UI that operates on components such as a Thesis and its Aspects to construct an overarching Discourse?
    - If yes, does such an experience provide a marked benefit over simply using a chat interface?

The specific features, UI/UX details, and the inherent limitations (5 aspects per turn) are still a work-in-progress, but this is the basic motivation behind Midwife! Thank you!