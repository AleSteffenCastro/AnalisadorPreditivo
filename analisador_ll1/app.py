from flask import Flask, render_template, jsonify

app = Flask(__name__)

GRAMMAR = {
    "S": ["A d"],
    "A": ["a B", "c D", "d S"],
    "B": ["b C", "d D"],
    "C": ["c A", "ε"],
    "D": ["a B"]
}

FIRST = {
    "S": {"a", "c", "d"},
    "A": {"a", "c", "d"},
    "B": {"b", "d"},
    "C": {"c", "ε"},
    "D": {"a"}
}

FOLLOW = {
    "S": {"$", "d"},
    "A": {"d"},
    "B": {"d"},
    "C": {"d"},
    "D": {"d"}
}

PARSING_TABLE = {
    "S": {"a": "A d", "b": "erro", "c": "A d", "d": "A d", "$": "erro"},
    "A": {"a": "a B", "b": "erro", "c": "c D", "d": "d S", "$": "erro"},
    "B": {"a": "erro", "b": "b C", "c": "erro", "d": "d D", "$": "erro"},
    "C": {"a": "erro", "b": "erro", "c": "c A", "d": "ε",   "$": "erro"},
    "D": {"a": "a B", "b": "erro", "c": "erro", "d": "erro", "$": "erro"}
}

# --- CONTROLLER (Rotas da Aplicação) ---

@app.route('/')
def index():
    """ Rota principal que serve o index.html """
    return render_template('index.html')

@app.route('/api/grammar_data')
def get_grammar_data():
    """ API que envia os dados da gramática (JSON) para o front-end """
    return jsonify({
        "grammar": GRAMMAR,
        "first": {k: list(v) for k, v in FIRST.items()},
        "follow": {k: list(v) for k, v in FOLLOW.items()},
        "table": PARSING_TABLE
    })


if __name__ == '__main__':
    app.run(debug=True)