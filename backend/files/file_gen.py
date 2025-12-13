import os
import random
from docx import Document

# CONFIG
OUTPUT_DIR = "generated_files_with_errors"
TOTAL_FILES = 1000
WORDS_PER_FILE = 2000
FILE_TYPES = ["txt", "md", "docx"]

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Base sentence templates (grammatically correct)
BASE_SENTENCES = [
    "Technology has changed the way people communicate with each other.",
    "Many users rely on software tools to complete daily tasks efficiently.",
    "Artificial intelligence is becoming more common in modern applications.",
    "People often make mistakes when they write very fast.",
    "This system is designed to test grammar and spelling capabilities.",
    "Sometimes sentences does not follow proper grammatical rules.",
    "The purpose of this text is to simulate human writing errors.",
    "Developers are building tools that detect language issues automatically.",
    "In many cases the error are small but still noticeable.",
    "Writing long content without mistakes is very difficult."
]

# Common spelling mistakes
SPELLING_ERRORS = {
    "technology": "technolgy",
    "people": "pepole",
    "communicate": "comunicate",
    "different": "diffrent",
    "important": "importent",
    "because": "becuase",
    "grammar": "grammer",
    "writing": "writting",
    "system": "sytem",
    "software": "softwere",
    "applications": "aplications",
    "mistakes": "mistaks",
    "efficiently": "efficently"
}

def introduce_spelling_errors(text, rate=0.15):
    words = text.split()
    for i in range(len(words)):
        clean_word = words[i].lower().strip(".,")
        if clean_word in SPELLING_ERRORS and random.random() < rate:
            words[i] = SPELLING_ERRORS[clean_word]
    return " ".join(words)

def introduce_grammar_errors(text):
    errors = [
        lambda s: s.replace(" is ", " are ", 1),
        lambda s: s.replace(" are ", " is ", 1),
        lambda s: s.replace(" has ", " have ", 1),
        lambda s: s.replace(".", "", 1),
        lambda s: s.replace(" the ", " teh ", 1),
    ]
    if random.random() < 0.3:
        text = random.choice(errors)(text)
    return text

def generate_error_text(word_count):
    content = []
    while len(" ".join(content).split()) < word_count:
        sentence = random.choice(BASE_SENTENCES)
        sentence = introduce_spelling_errors(sentence)
        sentence = introduce_grammar_errors(sentence)
        content.append(sentence)
    return " ".join(content)

for i in range(1, TOTAL_FILES + 1):
    file_type = random.choice(FILE_TYPES)
    text = generate_error_text(WORDS_PER_FILE)
    filename = f"file_{i}.{file_type}"
    path = os.path.join(OUTPUT_DIR, filename)

    if file_type in ["txt", "md"]:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    elif file_type == "docx":
        doc = Document()
        words = text.split()
        for j in range(0, len(words), 120):
            doc.add_paragraph(" ".join(words[j:j+120]))
        doc.save(path)

    print(f"Created: {filename}")

print("\n✅ 1000 files with spelling & grammar mistakes generated successfully!")
