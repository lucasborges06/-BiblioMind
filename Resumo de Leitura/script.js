document.addEventListener('DOMContentLoaded', () => {
    // --- SELEÇÃO DE ELEMENTOS DO DOM ---
    const form = document.getElementById('form-resumo');
    const summariesGrid = document.getElementById('summaries-grid');
    const searchBar = document.getElementById('search-bar');
    const sortBy = document.getElementById('sort-by');
    const themeToggle = document.getElementById('theme-toggle');
    const clearBtn = document.getElementById('clear-btn');
    const tagsInput = document.getElementById('tags-input');
    const tagsList = document.getElementById('tags-list');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    const modal = document.getElementById('view-modal');
    const modalCloseBtn = document.getElementById('modal-close');
    const modalEditBtn = document.getElementById('modal-edit-btn');
    const summaryIdInput = document.getElementById('summary-id');
    const formTitle = document.getElementById('form-title');

    // --- ESTADO DA APLICAÇÃO ---
    let summaries = JSON.parse(localStorage.getItem('biblioMindGM')) || [];
    let currentTags = [];
    let currentEditingId = null;

    // --- LÓGICA DO TEMA (CORRIGIDA E COMPLETA) ---
    const applyTheme = (theme) => {
        // 1. Aplica o atributo `data-theme` no elemento <html>, que ativa o CSS do tema.
        document.documentElement.setAttribute('data-theme', theme);
        // 2. Salva a preferência do usuário no localStorage para visitas futuras.
        localStorage.setItem('themeGM', theme);
        // 3. Garante que o estado visual do interruptor (checkbox) corresponda ao tema ativo.
        themeToggle.checked = theme === 'dark';
    };

    // Adiciona o "escutador" de eventos. Quando o interruptor muda (é clicado)...
    themeToggle.addEventListener('change', () => {
        // ...chama a função applyTheme, passando 'dark' se estiver marcado, ou 'light' se não estiver.
        applyTheme(themeToggle.checked ? 'dark' : 'light');
    });

    // --- FUNÇÕES DE DADOS E RENDERIZAÇÃO ---
    const saveToStorage = () => localStorage.setItem('biblioMindGM', JSON.stringify(summaries));

    const renderSummaries = () => {
        const filterText = searchBar.value.toLowerCase();
        let processedSummaries = summaries.filter(s =>
            s.fonte.toLowerCase().includes(filterText) ||
            s.tags.some(tag => tag.toLowerCase().includes(filterText))
        );

        switch (sortBy.value) {
            case 'oldest': processedSummaries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
            case 'az': processedSummaries.sort((a, b) => a.fonte.localeCompare(b.fonte)); break;
            case 'newest': default: processedSummaries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
        }

        summariesGrid.innerHTML = '';
        if (processedSummaries.length === 0) {
            summariesGrid.innerHTML = '<p>Nenhum resumo encontrado.</p>';
            return;
        }

        processedSummaries.forEach((summary, index) => {
            const card = document.createElement('article');
            card.className = 'summary-card';
            card.setAttribute('data-id', summary.id);
            card.style.animationDelay = `${index * 50}ms`;
            card.innerHTML = `
                <div class="card-tags">${summary.tags.map(tag => `<span class="card-tag">${tag}</span>`).join('')}</div>
                <h3>${summary.fonte}</h3>
                <p>${new Date(summary.updatedAt).toLocaleDateString('pt-BR')}</p>
            `;
            summariesGrid.appendChild(card);
        });
    };

    // --- FUNÇÕES DO FORMULÁRIO E EDITOR ---
    const clearForm = () => {
        form.reset();
        summaryIdInput.value = '';
        document.getElementById('ideia-central').innerHTML = '';
        document.getElementById('annotations').innerHTML = '';
        currentTags = [];
        renderTags();
        formTitle.innerHTML = '<i class="fa-solid fa-feather-pointed"></i> Novo Resumo';
        form.querySelector('.btn-primary').innerHTML = '<i class="fa-solid fa-save"></i> Salvar';
    };

    document.querySelectorAll('.editor-toolbar button').forEach(button => {
        button.addEventListener('click', () => {
            const command = button.dataset.command;
            document.execCommand(command, false, null);
        });
    });

    const renderTags = () => {
        tagsList.innerHTML = '';
        currentTags.forEach((tag, index) => {
            const li = document.createElement('li');
            li.className = 'tag-pill';
            li.innerHTML = `<span>${tag}</span><button data-index="${index}" title="Remover Tag">&times;</button>`;
            tagsList.appendChild(li);
        });
    };

    tagsList.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const index = e.target.dataset.index;
            currentTags.splice(index, 1);
            renderTags();
        }
    });

    tagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && tagsInput.value.trim() !== '') {
            e.preventDefault();
            const newTag = tagsInput.value.trim();
            if (!currentTags.includes(newTag)) {
                currentTags.push(newTag);
            }
            tagsInput.value = '';
            renderTags();
        }
    });

    // --- LÓGICA DO MODAL ---
    const openModal = (summary) => {
        document.getElementById('modal-title').textContent = summary.fonte;
        document.getElementById('modal-ideia-central').innerHTML = summary.ideiaCentralHTML;
        document.getElementById('modal-annotations').innerHTML = summary.annotationsHTML;
        document.getElementById('modal-tags').innerHTML = summary.tags.map(tag => `<span class="card-tag">${tag}</span>`).join('');
        const updated = new Date(summary.updatedAt).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
        document.getElementById('modal-timestamp').textContent = `Última atualização: ${updated}`;
        currentEditingId = summary.id;
        modal.classList.add('active');
    };
    const closeModal = () => modal.classList.remove('active');

    // --- IMPORTAR / EXPORTAR ---
    exportBtn.addEventListener('click', () => {
        if (summaries.length === 0) { showToast('Nenhum dado para exportar.', 'error'); return; }
        const dataStr = JSON.stringify(summaries, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `biblio-mind-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('Dados exportados com sucesso!');
    });
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    if (confirm('Isso substituirá todos os seus resumos atuais. Deseja continuar?')) {
                        summaries = importedData;
                        saveToStorage();
                        renderSummaries();
                        showToast('Dados importados com sucesso!');
                    }
                } else { throw new Error('Formato de arquivo inválido.'); }
            } catch (error) { showToast('Erro ao importar o arquivo.', 'error'); }
        };
        reader.readAsText(file);
        importFile.value = '';
    });

    // --- NOTIFICAÇÕES "TOAST" ---
    const showToast = (message, type = 'success') => {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    // --- EVENT LISTENERS PRINCIPAIS ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = summaryIdInput.value;
        const now = new Date().toISOString();
        const summaryData = {
            fonte: document.getElementById('fonte').value,
            tags: [...currentTags],
            ideiaCentralHTML: document.getElementById('ideia-central').innerHTML,
            annotationsHTML: document.getElementById('annotations').innerHTML,
            updatedAt: now
        };
        if (summaryData.fonte.trim() === '') {
            showToast('O campo "Fonte" é obrigatório.', 'error');
            return;
        }

        if (id) {
            const index = summaries.findIndex(s => s.id == id);
            summaries[index] = { ...summaries[index], ...summaryData };
            showToast('Resumo atualizado com sucesso!');
        } else {
            summaryData.id = Date.now();
            summaryData.createdAt = now;
            summaries.push(summaryData);
            showToast('Resumo salvo com sucesso!');
        }
        saveToStorage();
        renderSummaries();
        clearForm();
    });

    clearBtn.addEventListener('click', clearForm);
    searchBar.addEventListener('input', renderSummaries);
    sortBy.addEventListener('change', renderSummaries);
    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    modalEditBtn.addEventListener('click', () => {
        const summary = summaries.find(s => s.id === currentEditingId);
        if (summary) {
            summaryIdInput.value = summary.id;
            document.getElementById('fonte').value = summary.fonte;
            document.getElementById('ideia-central').innerHTML = summary.ideiaCentralHTML;
            document.getElementById('annotations').innerHTML = summary.annotationsHTML;
            currentTags = [...summary.tags];
            renderTags();
            formTitle.innerHTML = '<i class="fa-solid fa-edit"></i> Editando Resumo';
            form.querySelector('.btn-primary').innerHTML = '<i class="fa-solid fa-sync-alt"></i> Atualizar';
            closeModal();
            form.scrollIntoView({ behavior: 'smooth' });
        }
    });

    summariesGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.summary-card');
        if (card) {
            const id = Number(card.getAttribute('data-id'));
            const summary = summaries.find(s => s.id === id);
            if (summary) openModal(summary);
        }
    });

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    // 1. Verifica se já existe um tema salvo no localStorage. Se não, usa 'light' como padrão.
    const savedTheme = localStorage.getItem('themeGM') || 'light';
    // 2. Aplica o tema salvo (ou o padrão) assim que a página carrega.
    applyTheme(savedTheme);
    // 3. Renderiza os resumos salvos na tela.
    renderSummaries();
});