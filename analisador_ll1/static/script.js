// --- Variáveis Globais de Estado ---
let G_DATA = {};
let interactiveStack = [];
let interactiveTrace = [];
let interactiveSentence = ""; // Armazena a sentença do modo interativo

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    loadGrammarData();
    document.getElementById('parse-button').addEventListener('click', handleParseFromText);
    document.getElementById('reset-button').addEventListener('click', initializeUI);
});

async function loadGrammarData() {
    try {
        const response = await fetch('/api/grammar_data');
        const data = await response.json();
        G_DATA = data; 

        renderGrammar(data.grammar);
        renderSet(data.first, document.getElementById('first-display'));
        renderSet(data.follow, document.getElementById('follow-display'));
        renderParsingTable(data.table, data.first);
        
        attachTableListeners();
        initializeUI(); // Prepara a UI no carregamento

    } catch (error) {
        console.error('Erro ao carregar dados da gramática:', error);
    }
}

// --- MODO 1: ANÁLISE POR TEXTO (Clique em "Analisar") ---

/**
 * Lida com o clique do botão "Analisar".
 * Executa o parser 100% no JavaScript.
 */
function handleParseFromText() {
    const sentence = document.getElementById('sentence-input').value;
    const inputSymbols = sentence.replace(/\s+/g, '').split('');
    inputSymbols.push('$'); // Adiciona $ no fim da fita
    
    let stack = ['$', 'S'];
    let trace = [];
    let steps = 0;

    // Função interna para formatar estado
    const getStackStr = (s) => [...s].reverse().join(' ');
    const getInputStr = (i) => i.join('');

    trace.push({
        step: steps,
        stack: getStackStr(stack),
        input: getInputStr(inputSymbols),
        action: "Inicialização"
    });

    // Loop principal do analisador preditivo
    while (stack.length > 0) {
        steps++;
        const topOfStack = stack[stack.length - 1]; // Pega o topo (peek)
        const currentInput = inputSymbols[0];
        
        let action = "";

        if (topOfStack === currentInput) {
            if (topOfStack === "$") {
                action = "Match $ e $ - ACEITAR";
                trace.push({step: steps, stack: getStackStr(stack), input: getInputStr(inputSymbols), action: action});
                renderResult("Aceito", steps, sentence);
                renderFullTrace(trace);
                clearTableHighlight();
                return;
            }
            
            // CORREÇÃO: Trocado f"" por ``
            action = `Match '${currentInput}'`;
            stack.pop();
            inputSymbols.shift(); // Consome da fita
            
        } else if (G_DATA.table[topOfStack]) { // É um Não-Terminal
            const production = G_DATA.table[topOfStack][currentInput];
            
            if (production === 'erro' || !production) {
                // CORREÇÃO: Trocado f"" por ``
                action = `Erro: M[${topOfStack}, ${currentInput}] é inválido.`;
                trace.push({step: steps, stack: getStackStr(stack), input: getInputStr(inputSymbols), action: action});
                renderResult("Rejeitado", steps, sentence);
                renderFullTrace(trace);
                clearTableHighlight();
                return;
            }
            
            stack.pop(); // Remove N-T
            
            if (production !== "ε") {
                const symbolsToPush = production.split(' ').reverse();
                symbolsToPush.forEach(symbol => stack.push(symbol));
                // CORREÇÃO: Trocado f"" por ``
                action = `Produção: ${topOfStack} ::= ${production}`;
            } else {
                // CORREÇÃO: Trocado f"" por ``
                action = `Produção: ${topOfStack} ::= ε`;
            }
        
        } else { // Erro de match de terminais
            // CORREÇÃO: Trocado f"" por ``
            action = `Erro: Esperava '${topOfStack}' mas encontrou '${currentInput}'`;
            trace.push({step: steps, stack: getStackStr(stack), input: getInputStr(inputSymbols), action: action});
            renderResult("Rejeitado", steps, sentence);
            renderFullTrace(trace);
            clearTableHighlight();
            return;
        }

        trace.push({
            step: steps,
            stack: getStackStr(stack),
            input: getInputStr(inputSymbols),
            action: action
        });
    }
}

// --- MODO 2: ANÁLISE INTERATIVA (POR CLIQUE NA TABELA) ---

/**
 * Reseta a UI para o estado inicial (limpo).
 */
function initializeUI() {
    interactiveStack = ['$', 'S'];
    interactiveTrace = [];
    interactiveSentence = "";
    
    clearTraceAndResult();
    document.getElementById('sentence-input').value = ""; // Limpa a fita
    
    addInteractiveTraceStep("Inicialização");
    renderInteractiveTraceTable(); // Mostra o traço de 3 colunas
    highlightCurrentRow();
}

/**
 * Adiciona listeners de clique à Tabela de Parsing.
 */
function attachTableListeners() {
    document.getElementById('parsing-table-body').addEventListener('click', (event) => {
        const cell = event.target.closest('td');
        if (!cell || interactiveStack.length === 0) return;

        const topOfStack = interactiveStack[interactiveStack.length - 1];
        const rowId = `row-${topOfStack}`;
        if (cell.parentElement.id !== rowId) return;

        // Limpa o traço se for o primeiro clique de uma nova análise
        if (interactiveTrace.length <= 1) { 
             clearTraceAndResult();
             interactiveStack = ['$', 'S'];
             interactiveTrace = [];
             interactiveSentence = "";
             addInteractiveTraceStep("Inicialização");
        }

        // Célula de Erro
        if (cell.classList.contains('error')) {
            const nonTerminal = cell.dataset.nt;
            const terminal = cell.dataset.terminal;
            handleInteractiveError(nonTerminal, terminal);
            return;
        }
        
        // Célula de Produção
        if (cell.classList.contains('production')) {
            const production = cell.dataset.prod;
            processInteractiveStep(production);
        }
    });
}

/**
 * Processa um passo de GERAÇÃO (clique) e o auto-consumo.
 */
function processInteractiveStep(production) {
    const nonTerminal = interactiveStack.pop();

    if (production !== 'ε') {
        const symbols = production.split(' ').reverse();
        symbols.forEach(symbol => interactiveStack.push(symbol));
    }
    addInteractiveTraceStep(`Produção: ${nonTerminal} ::= ${production}`);

    while (interactiveStack.length > 0) {
        const topOfStack = interactiveStack[interactiveStack.length - 1];
        if (G_DATA.grammar[topOfStack]) break; // Para se for Não-Terminal

        interactiveStack.pop(); // Consome
        
        if (topOfStack !== '$') {
            addInteractiveTraceStep(`Match (Geração): '${topOfStack}'`);
            interactiveSentence += topOfStack; // Constrói a sentença
        } else {
            addInteractiveTraceStep("Match $ e $ - ACEITAR");
            const finalSentence = interactiveSentence.split('').join(' ');
            renderResult("Aceito", interactiveTrace.length - 1, finalSentence);
            interactiveStack = [];
        }
    }
    
    // Atualiza a caixa de texto (fita de entrada)
    document.getElementById('sentence-input').value = interactiveSentence.split('').join(' ');
    
    renderInteractiveTraceTable();
    highlightCurrentRow();
}

/**
 * Lida com um clique de erro no modo interativo.
 */
function handleInteractiveError(nonTerminal, terminal) {
    addInteractiveTraceStep(`Erro: M[${nonTerminal}, ${terminal}] é inválido.`);
    const finalSentence = interactiveSentence.split('').join(' ');
    renderResult("Rejeitado", interactiveTrace.length - 1, finalSentence);
    interactiveStack = [];
    renderInteractiveTraceTable();
    highlightCurrentRow();
}

// --- FUNÇÕES DE RENDERIZAÇÃO DE DADOS ESTÁTICOS ---

function renderGrammar(grammar) {
    let html = '';
    for (const nonTerminal in grammar) {
        const productions = grammar[nonTerminal].join(' | ');
        html += `<strong>${nonTerminal}</strong> ::= ${productions}\n`;
    }
    document.getElementById('grammar-display').innerHTML = html;
}

function renderSet(set, element) {
    let html = '';
    for (const nonTerminal in set) {
        const symbols = set[nonTerminal].join(', ');
        html += `<strong>${nonTerminal}</strong> = { ${symbols} }\n`;
    }
    element.innerHTML = html;
}

function renderParsingTable(table, first) {
    const container = document.getElementById('parsing-table-wrapper');
    
    let terminals = new Set();
    Object.values(first).forEach(f => f.forEach(sym => {
        if (sym !== 'ε') terminals.add(sym);
    }));
    terminals.add('$');
    const sortedTerminals = Array.from(terminals).sort((a, b) => {
        if (a === '$') return 1; if (b === '$') return -1;
        return a.localeCompare(b);
    });

    const allNonTerminals = Object.keys(table);
    const sortedNonTerminals = allNonTerminals.filter(nt => nt !== 'S').sort();
    sortedNonTerminals.unshift('S');

    let html = '<table><thead><tr><th>N-T</th>';
    sortedTerminals.forEach(t => html += `<th>${t}</th>`);
    html += '</tr></thead><tbody id="parsing-table-body">';

    sortedNonTerminals.forEach(nonTerminal => {
        html += `<tr id="row-${nonTerminal}">`;
        html += `<td><strong>${nonTerminal}</strong></td>`;
        
        sortedTerminals.forEach(terminal => {
            const production = table[nonTerminal][terminal];
            if (production && production !== 'erro') {
                html += `<td class="production" data-nt="${nonTerminal}" data-prod="${production}">${nonTerminal} ::= ${production}</td>`;
            } else {
                html += `<td class="error" data-nt="${nonTerminal}" data-terminal="${terminal}"></td>`;
            }
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// --- FUNÇÕES DE RENDERIZAÇÃO DE RESULTADO E TRAÇO ---

/**
 * Renderiza a caixa de resultado (formato unificado).
 */
function renderResult(status, steps, sentence) {
    const resultMsg = document.getElementById('result-message');
    if (!status) {
        resultMsg.innerHTML = "";
        resultMsg.className = "message";
        return;
    }
    
    const formattedSentence = sentence.includes(' ') ? sentence : sentence.split('').join(' ');
    const statusText = status.startsWith('Aceito') ? 'ACEITO' : 'REJEITADO';
    const statusClass = status.startsWith('Aceito') ? 'success' : 'error';

    resultMsg.innerHTML = `
        <strong>${statusText}</strong> (em ${steps} passos)
        <br>
        <span class="result-sentence">Sentença: ${formattedSentence || 'ε'}</span>
    `;
    resultMsg.className = `message ${statusClass}`;
}

/**
 * Renderiza o traço COMPLETO (4 colunas) do Modo Texto.
 */
function renderFullTrace(trace) {
    const container = document.getElementById('trace-display');
    let html = '<table><thead><tr><th>Passo</th><th>Pilha</th><th>Fita de Entrada</th><th>Ação</th></tr></thead><tbody>';

    trace.forEach(step => {
        html += `
            <tr>
                <td>${step.step}</td>
                <td><pre>${step.stack}</pre></td>
                <td><pre>${step.input}</pre></td>
                <td>${step.action}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Renderiza o traço INTERATIVO (3 colunas) do Modo Interativo.
 */
function renderInteractiveTraceTable() {
    const container = document.getElementById('trace-display');
    let html = '<table><thead><tr><th>Passo</th><th>Pilha</th><th>Ação</th></tr></thead><tbody>';

    interactiveTrace.forEach((step, index) => {
        html += `
            <tr>
                <td>${index}</td>
                <td><pre>${step.stack}</pre></td>
                <td>${step.action}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// --- FUNÇÕES AUXILIARES DE UI ---

function addInteractiveTraceStep(action) {
    const stackString = [...interactiveStack].reverse().join(' ');
    interactiveTrace.push({ stack: stackString, action: action });
}

function clearTraceAndResult() {
    document.getElementById('trace-display').innerHTML = '';
    renderResult("", 0, "");
}

function clearTableHighlight() {
    document.querySelectorAll('#parsing-table-body tr').forEach(row => {
        row.classList.remove('highlight-row');
    });
}

function highlightCurrentRow() {
    clearTableHighlight();
    if (interactiveStack.length > 0) {
        const top = interactiveStack[interactiveStack.length - 1];
        if (G_DATA.grammar[top]) {
            const row = document.getElementById(`row-${top}`);
            if (row) {
                row.classList.add('highlight-row');
            }
        }
    }
}   