const API_BASE = '/api';
let currentPage = 1;
const limit = 20;
let debounceTimer; // Variável para controlar o tempo de espera da digitação

// --- CARREGAR ESTATÍSTICAS ---
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/logs/stats`);
        const data = await response.json();
        
        document.getElementById('stat-total').textContent = formatNumber(data.total_logs);
        document.getElementById('stat-cpfs').textContent = formatNumber(data.cpfs_unicos);
        document.getElementById('stat-macs').textContent = formatNumber(data.macs_unicos);
        document.getElementById('stat-24h').textContent = formatNumber(data.logs_ultimas_24h);
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// --- CARREGAR LOGS (PAGINAÇÃO) ---
async function loadLogs(page = 1) {
    currentPage = page;
    const container = document.getElementById('logs-container');
    container.innerHTML = '<div class="loading">Carregando dados...</div>';

    try {
        const response = await fetch(`${API_BASE}/logs?page=${page}&limit=${limit}`);
        const data = await response.json();
        
        renderLogsTable(data.data);
        renderPagination(data.pagination);
    } catch (error) {
        container.innerHTML = '<div class="error">Falha na conexão com o servidor.</div>';
        console.error(error);
    }
}

// --- LÓGICA DE BUSCA AUTOMÁTICA (DEBOUNCE) ---
function triggerAutoSearch(inputType) {
    const cpf = document.getElementById('search-cpf').value.trim();
    const mac = document.getElementById('search-mac').value.trim();
    const date = document.getElementById('search-date').value;

    // Cancela a busca anterior se o usuário ainda estiver digitando
    clearTimeout(debounceTimer);

    // Lógica de validação antes de buscar
    if (inputType === 'text') {
        // Se for texto (CPF/MAC), verifica se tem algo digitado E se é menor que 3
        // Se limpou o campo (length 0), permite passar para resetar a busca
        if (cpf.length > 0 && cpf.length < 3 && !mac && !date) return;
        if (mac.length > 0 && mac.length < 3 && !cpf && !date) return;
    }

    // Aguarda 500ms após a última digitação para buscar (Debounce)
    debounceTimer = setTimeout(() => {
        // Se todos os campos estiverem vazios, recarrega o padrão
        if (!cpf && !mac && !date) {
            loadLogs(1);
        } else {
            searchLogs();
        }
    }, 300);
}

// --- BUSCA NA API ---
async function searchLogs() {
    const cpf = document.getElementById('search-cpf').value.trim();
    const mac = document.getElementById('search-mac').value.trim();
    const date = document.getElementById('search-date').value;

    // Verificação de segurança: não busca se tiver texto curto (ex: 1 ou 2 letras)
    // a menos que tenha uma data selecionada junto
    if ((cpf && cpf.length < 3) && !date && !mac) return;
    if ((mac && mac.length < 3) && !date && !cpf) return;

    const container = document.getElementById('logs-container');
    container.innerHTML = '<div class="loading">Buscando...</div>';

    try {
        const params = new URLSearchParams();
        if (cpf && cpf.length >= 3) params.append('cpf', cpf);
        if (mac && mac.length >= 3) params.append('mac', mac);
        if (date) params.append('date', date);

        const response = await fetch(`${API_BASE}/logs/search?${params}`);
        const data = await response.json();
        
        renderLogsTable(data.data);
        
        document.getElementById('pagination').innerHTML = 
            `<span style="color: var(--ios-gray)">Encontrados: ${data.count || data.data.length} registros</span>`;
    } catch (error) {
        container.innerHTML = '<div class="error">Erro na busca.</div>';
    }
}

// --- LIMPAR BUSCA ---
function clearSearch() {
    document.getElementById('search-cpf').value = '';
    document.getElementById('search-mac').value = '';
    document.getElementById('search-date').value = '';
    loadLogs(1);
}

// --- RENDERIZAR TABELA ---
function renderLogsTable(logs) {
    const container = document.getElementById('logs-container');
    
    if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="loading">Nenhum registro encontrado.</div>';
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th style="width: 80px">ID</th>
                    <th>CPF do Usuário</th>
                    <th>Endereço MAC</th>
                    <th style="text-align: right">Timestamp</th>
                </tr>
            </thead>
            <tbody>
    `;

    logs.forEach(log => {
        html += `
            <tr>
                <td><span class="badge-id font-mono">#${log.id}</span></td>
                <td><span class="badge-cpf font-mono">${formatCPF(log.cpf)}</span></td>
                <td><span class="badge-mac font-mono">${log.mac_address}</span></td>
                <td style="text-align: right; color: var(--ios-gray); font-size: 0.8rem;">
                    ${formatDate(log.horario)}
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// --- RENDERIZAR PAGINAÇÃO ---
function renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if(!pagination) return; 

    const { page, totalPages } = pagination;

    container.innerHTML = `
        <button onclick="loadLogs(${page - 1})" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
        <span>Página ${page} de ${totalPages}</span>
        <button onclick="loadLogs(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Próxima</button>
    `;
}

// --- FORMATADORES ---
function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num || 0);
}

function formatCPF(cpf) {
    if (!cpf) return '-';
    const digits = cpf.replace(/\D/g, '');
    if (digits.length === 11) {
        return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
    }
    return cpf;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date);
}

// Função para pegar a data de hoje formatada (YYYY-MM-DD)
function getTodayString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- EVENT LISTENERS ---
document.addEventListener("DOMContentLoaded", () => {
    
    // Listeners para CPF e MAC
    document.getElementById('search-cpf').addEventListener('input', () => triggerAutoSearch('text'));
    document.getElementById('search-mac').addEventListener('input', () => triggerAutoSearch('text'));
    
    // Listener para Data
    document.getElementById('search-date').addEventListener('change', () => triggerAutoSearch('date'));
    
    // Listener de Enter
    document.getElementById('search-cpf').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { clearTimeout(debounceTimer); searchLogs(); }
    });
    document.getElementById('search-mac').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { clearTimeout(debounceTimer); searchLogs(); }
    });

    // --- INICIALIZAÇÃO COM DATA DE HOJE ---
    
    // 1. Define o valor do input para hoje
    document.getElementById('search-date').value = getTodayString(); // <--- Define a data visualmente

    // 2. Carrega estatísticas
    loadStats();

    // 3. Em vez de chamar loadLogs(1) que traria tudo, chamamos searchLogs()
    // Como o input já está preenchido com a data, ele vai buscar filtrando por hoje.
    searchLogs(); // <--- Busca inicial filtrada
    
    // Atualização automática a cada 30s
    setInterval(() => {
        loadStats();
    }, 30000);
});