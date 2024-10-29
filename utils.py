def summarize_aspect(aspect_content):
    mapping = {
        "Unicorns are real." : "Reality of Unicorns",
        "What do you define as 'real'?" : "Definition of Real?",
        "Can you support your claim with evidence or examples?" : "Supporting Evidence?",
        "Is 'real' defined as perceptible?" : "Defined as perceptible?",
        "Can what is 'real' be different for two people?" : "Can differ for two people?",
        "Is it not impossible to prove non-existence" : "Impossible to prove negative?",
        "Why do we need empirical examples?" : "Why empiricism?"
    }

    return mapping[aspect_content]