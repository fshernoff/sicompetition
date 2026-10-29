"""Write the exact prompt text for one subject's image call (the text mockup.sh is given as its description).
usage: make_prompt.py <subject> [<extra sentence>]  -> prints the prompt
A subject is a key of subjects.json (a dog breed), 'crew' or 'crew2' (prompts/crew.txt, prompts/crew2.txt). The extra sentence, if given, goes before the background
paragraph: it is how a retake names its locked reference (the breed's first clean strip)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, 'prompts')


def read(name):
    with open(os.path.join(P, name)) as f:
        return f.read().strip()


def prompt(subject, extra=''):
    pre, post = read('pre.txt'), read('post.txt')
    if subject.startswith('crew'):
        body = read(f'{subject}.txt')           # crew.txt (the first crew member), crew2.txt (the second)
    else:
        with open(os.path.join(HERE, 'subjects.json')) as f:
            s = json.load(f)[subject]
        body = (read('dog.txt').replace('{BREED}', s['breed']).replace('{TAIL_TROT}', s['tail_trot'])
                .replace('{TAIL_SLEEP}', s['tail_sleep']))
    parts = [pre, body]
    if extra:
        parts.append(extra.strip())
    parts += [post, 'Landscape 3:2.']
    return ' '.join(parts)


if __name__ == '__main__':
    print(prompt(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ''))
