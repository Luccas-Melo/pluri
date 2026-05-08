const categories = [
    { id: 'Comida', svg: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>' },
    { id: 'Lazer', svg: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="15" cy="13" r="1"/>' },
    { id: 'Mercado', svg: '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' },
    { id: 'Viagem', svg: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>' },
    { id: 'Outros', svg: '<circle cx="12" cy="12" r="3"/><path d="M3 12h3m12 0h3M12 3v3m0 12v3"/>' }
];

window.addEventListener('error', (event) => {
    console.error(event.error || event.message || event);
    setLoading(false);
    showToast(`Erro no app: ${(event.error && event.error.message) || event.message || 'desconhecido'}`);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error(event.reason || event);
    setLoading(false);
    const message = event.reason?.message || String(event.reason || 'desconhecido');
    showToast(`Erro assíncrono: ${message}`);
});

const defaultAppConfig = {
    appName: 'Pluri',
    householdType: 'couple',
    members: [
        { name: 'Pessoa 1', theme: 'bel' },
        { name: 'Pessoa 2', theme: 'luccas' }
    ]
};

const defaultMeta = { ativa: false, nome: '', alvo: 0, atual: 0 };

let supabaseClient = null;
let currentSession = null;
let currentProfile = null;
let currentHousehold = null;
let currentMembers = [];
let currentCards = [];
let currentGoalId = null;
let currentRecoveryMode = false;
let authMode = 'login';
let onboardingHouseholdType = 'couple';
let currentThemeMode = 'light';

let gastos = [];
let meta = { ...defaultMeta };
let cartoes = [];
let cartaoFavorito = {};
let appConfig = { ...defaultAppConfig };
let householdTypeDraft = appConfig.householdType;
let pagadorAtual = appConfig.members[0].name;
let categoriaSelecionada = 'Comida';
let metodoPagamento = 'PIX';
let cartaoSelecionado = '';
let chart = null;
let deleteIdTemp = null;

document.getElementById('dataGasto').valueAsDate = new Date();

function $(id) {
    return document.getElementById(id);
}

function loadThemePreference() {
    const saved = localStorage.getItem('pluri_theme_mode');
    return saved === 'dark' ? 'dark' : 'light';
}

function updateThemeLabels() {
    const nextLabel = currentThemeMode === 'dark' ? 'Tema Escuro' : 'Tema Claro';
    if ($('themeToggleLabelAuth')) $('themeToggleLabelAuth').innerText = nextLabel;
    if ($('themeToggleLabelApp')) $('themeToggleLabelApp').innerText = nextLabel;
}

function applyTheme(mode) {
    currentThemeMode = mode === 'dark' ? 'dark' : 'light';
    $('mainBody').classList.toggle('dark-theme', currentThemeMode === 'dark');
    $('mainBody').classList.toggle('light-theme', currentThemeMode !== 'dark');
    localStorage.setItem('pluri_theme_mode', currentThemeMode);
    updateThemeLabels();
}

function toggleTheme() {
    applyTheme(currentThemeMode === 'dark' ? 'light' : 'dark');
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function quoteJs(value) {
    return JSON.stringify(String(value ?? ''));
}

function normalizeMetodo(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isCartaoMetodo(value) {
    return normalizeMetodo(value).includes('cart');
}

function formatExpenseDate(dateStr) {
    const date = new Date(`${dateStr}T12:00:00`);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerText = msg;
    $('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function openModal(id) {
    $(id).style.display = 'flex';
}

function closeModal(id) {
    $(id).style.display = 'none';
}

function setLoading(visible, text = 'Carregando...') {
    const loading = $('loading');
    if (!loading) return;
    loading.style.display = visible ? 'flex' : 'none';
    const label = loading.querySelector('span');
    if (label) label.innerText = text;
}

function hideAllOverlays() {
    $('setupNotice').classList.add('hidden');
    $('authOverlay').classList.add('hidden');
    $('onboardingOverlay').classList.add('hidden');
}

function showAppShell(show) {
    $('appShell').classList.toggle('hidden', !show);
}

function getSupabaseConfig() {
    return window.PLURI_SUPABASE_CONFIG || {};
}

function isSupabaseConfigured() {
    const config = getSupabaseConfig();
    return Boolean(
        config.url &&
        config.anonKey &&
        !config.url.includes('COLE_AQUI') &&
        !config.anonKey.includes('COLE_AQUI')
    );
}

function createSupabaseClient() {
    if (!isSupabaseConfigured()) return null;
    const config = getSupabaseConfig();
    return window.supabase.createClient(config.url, config.anonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
}

function getActiveMembers() {
    return appConfig.householdType === 'solo'
        ? [appConfig.members[0]]
        : appConfig.members.filter((member) => member.name).slice(0, 2);
}

function getMemberTheme(name) {
    const index = getActiveMembers().findIndex((member) => member.name === name);
    return index === 1 ? 'luccas' : 'bel';
}

function getThemeStyles(theme) {
    return theme === 'luccas'
        ? { bodyClass: 'luccas-theme', colorVar: 'var(--luccas)', textColor: '#fff', buttonClass: 'luccas-bg' }
        : { bodyClass: 'bel-theme', colorVar: 'var(--bel)', textColor: '#000', buttonClass: 'bel-bg' };
}

function getFavoriteKeyByName(name) {
    const index = appConfig.members.findIndex((member) => member.name === name);
    return index >= 0 ? `member_${index}` : name;
}

function getPaymentMethodForDb() {
    return isCartaoMetodo(metodoPagamento) ? 'credit_card' : 'pix';
}

function getUiMetodoFromDb(row) {
    if (row.payment_method === 'credit_card') {
        const card = currentCards.find((item) => item.id === row.card_id);
        return ` ${card?.name || 'Cartao'}`;
    }
    if (row.payment_method === 'pix') return ' PIX';
    return ` ${String(row.payment_method || 'Outro').toUpperCase()}`;
}

function makeUiExpense(row) {
    const member = currentMembers.find((item) => item.id === row.member_id);
    return {
        id: row.id,
        memberId: row.member_id,
        cardId: row.card_id,
        valor: Number(row.amount),
        categoria: row.category,
        descricao: row.description,
        pagador: member?.display_name || 'Pessoa',
        metodo: getUiMetodoFromDb(row),
        mes: row.occurred_on.substring(5, 7),
        dataRaw: row.occurred_on,
        dataDisplay: formatExpenseDate(row.occurred_on),
        isFixo: Boolean(row.is_fixed)
    };
}

function updateIdentityUI() {
    const activeMembers = getActiveMembers();
    document.title = `${appConfig.appName} | Pluri`;

    if (activeMembers.length === 1) {
        $('headerTitle').innerHTML = `<span class="bel-text">${escapeHtml(activeMembers[0].name).toUpperCase()}</span>`;
    } else {
        $('headerTitle').innerHTML = `<span class="bel-text">${escapeHtml(activeMembers[0].name).toUpperCase()}</span> & <span class="luccas-text">${escapeHtml(activeMembers[1].name).toUpperCase()}</span>`;
    }

    $('totalLabel0').innerText = activeMembers[0]?.name || 'Pessoa 1';
    $('memberCard1').classList.toggle('hidden', activeMembers.length === 1);
    if (activeMembers[1]) $('totalLabel1').innerText = activeMembers[1].name;

    const badge = $('userBadge');
    if (currentSession?.user?.email) {
        badge.classList.remove('hidden');
        badge.innerText = currentSession.user.email;
    } else {
        badge.classList.add('hidden');
    }
    $('logoutButton').classList.toggle('hidden', !currentSession);
}

function renderPayerButtons() {
    const members = getActiveMembers();
    const container = $('payerButtons');
    container.innerHTML = members.map((member) => {
        const active = member.name === pagadorAtual;
        const theme = getThemeStyles(member.theme);
        return `
            <button type="button" onclick='setPayer(${quoteJs(member.name)})' class="flex-1 py-3 text-[10px] font-black rounded-2xl transition-all ${active ? theme.buttonClass : ''}" style="${active ? '' : 'color: var(--text-soft); background: transparent;'}">
                ${escapeHtml(member.name).toUpperCase()}
            </button>
        `;
    }).join('');
}

function renderEditPagadorOptions() {
    const members = getActiveMembers();
    $('editPagadorDropdown').innerHTML = members.map((member, index) => `
        <div class="edit-pagador-option px-4 py-3 hover:bg-white/10 cursor-pointer text-sm font-medium transition-colors ${index === 0 ? 'selecionado' : ''}" data-value="${escapeHtml(member.name)}" onclick='selectEditPagador(${quoteJs(member.name)})'>
            ${escapeHtml(member.name)}
        </div>
    `).join('');
    if (members[0]) {
        $('editPagador').value = members[0].name;
        $('editPagadorText').innerText = members[0].name;
    }
}

function setPayer(pagador) {
    pagadorAtual = pagador;
    const theme = getThemeStyles(getMemberTheme(pagador));
    $('mainBody').className = `pb-10 px-4 ${currentThemeMode}-theme ${theme.bodyClass}`;
    $('formContainer').style.borderColor = theme.colorVar;
    $('btnSubmit').style.background = theme.colorVar;
    $('btnSubmit').style.color = theme.textColor;
    renderPayerButtons();
    selecionarCartaoFavorito(pagador);
}

function setHouseholdType(type) {
    householdTypeDraft = type === 'solo' ? 'solo' : 'couple';
    $('btnModeCouple').className = householdTypeDraft === 'couple'
        ? 'py-3 rounded-2xl font-black text-[10px] uppercase active-chip'
        : 'py-3 rounded-2xl font-black text-[10px] uppercase';
    $('btnModeCouple').style.background = householdTypeDraft === 'couple' ? '' : 'var(--bg-elevated)';
    $('btnModeCouple').style.border = '1px solid var(--border)';
    $('btnModeCouple').style.color = householdTypeDraft === 'couple' ? '' : 'var(--text)';

    $('btnModeSolo').className = householdTypeDraft === 'solo'
        ? 'py-3 rounded-2xl font-black text-[10px] uppercase active-chip'
        : 'py-3 rounded-2xl font-black text-[10px] uppercase';
    $('btnModeSolo').style.background = householdTypeDraft === 'solo' ? '' : 'var(--bg-elevated)';
    $('btnModeSolo').style.border = '1px solid var(--border)';
    $('btnModeSolo').style.color = householdTypeDraft === 'solo' ? '' : 'var(--text)';
    $('editPessoa2Nome').disabled = householdTypeDraft === 'solo';
    $('editPessoa2Nome').parentElement.classList.toggle('opacity-50', householdTypeDraft === 'solo');
}

function setOnboardingHouseholdType(type) {
    onboardingHouseholdType = type === 'solo' ? 'solo' : 'couple';
    $('onboardingModeCouple').className = onboardingHouseholdType === 'couple'
        ? 'py-3 rounded-2xl font-black text-[10px] uppercase active-chip'
        : 'py-3 rounded-2xl font-black text-[10px] uppercase';
    $('onboardingModeCouple').style.background = onboardingHouseholdType === 'couple' ? '' : 'var(--bg-elevated)';
    $('onboardingModeCouple').style.border = '1px solid var(--border)';
    $('onboardingModeCouple').style.color = onboardingHouseholdType === 'couple' ? '' : 'var(--text)';

    $('onboardingModeSolo').className = onboardingHouseholdType === 'solo'
        ? 'py-3 rounded-2xl font-black text-[10px] uppercase active-chip'
        : 'py-3 rounded-2xl font-black text-[10px] uppercase';
    $('onboardingModeSolo').style.background = onboardingHouseholdType === 'solo' ? '' : 'var(--bg-elevated)';
    $('onboardingModeSolo').style.border = '1px solid var(--border)';
    $('onboardingModeSolo').style.color = onboardingHouseholdType === 'solo' ? '' : 'var(--text)';
    $('onboardingPessoa2Wrap').classList.toggle('opacity-50', onboardingHouseholdType === 'solo');
    $('onboardingPessoa2').disabled = onboardingHouseholdType === 'solo';
}

function toggleMetaInputs() {
    const ativa = $('metaAtiva').checked;
    $('metaFields').style.opacity = ativa ? '1' : '0.5';
    $('metaFields').style.pointerEvents = ativa ? 'all' : 'none';
}

function updateSyncUi() {
    const usingSupabase = Boolean(supabaseClient);
    $('syncButton').innerHTML = usingSupabase
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> Sincronizar agora'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> Sincronizar com Planilha';
    $('syncDescription').innerText = usingSupabase
        ? 'Recarrega gastos, cartões e meta direto do Supabase.'
        : 'Baixa todos os gastos salvos na planilha';
}

function switchAuthMode(mode) {
    authMode = mode;
    currentRecoveryMode = false;
    $('authName').classList.toggle('hidden', mode !== 'signup');
    $('authPasswordConfirm').classList.toggle('hidden', mode !== 'signup');
    $('authPassword').classList.toggle('hidden', mode === 'reset');
    $('authPassword').required = mode !== 'reset';
    $('authPasswordConfirm').required = mode === 'signup';
    $('recoveryForm').classList.add('hidden');
    $('authForm').classList.remove('hidden');

    const tabs = {
        login: $('tabLogin'),
        signup: $('tabSignup'),
        reset: $('tabReset')
    };

    Object.entries(tabs).forEach(([key, element]) => {
        element.classList.toggle('active', key === mode);
        element.classList.toggle('text-slate-400', key !== mode);
    });

    $('authSubmitBtn').innerText = mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Enviar link' : 'Entrar';
    $('authMessage').innerText = '';
}

function showRecoveryForm() {
    currentRecoveryMode = true;
    $('authOverlay').classList.remove('hidden');
    $('authForm').classList.add('hidden');
    $('recoveryForm').classList.remove('hidden');
    $('authMessage').innerText = 'Defina sua nova senha.';
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabaseClient) return;

    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const fullName = $('authName').value.trim();
    const submitButton = $('authSubmitBtn');
    const originalText = submitButton.innerText;

    submitButton.disabled = true;
    submitButton.classList.add('opacity-70', 'cursor-not-allowed');
    $('authMessage').innerText = 'Processando...';

    try {
        if (authMode === 'signup') {
            if (password !== $('authPasswordConfirm').value) {
                $('authMessage').innerText = 'As senhas nao conferem.';
                return;
            }

            const { error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName }
                }
            });

            $('authMessage').innerText = error ? error.message : 'Conta criada. Verifique seu email para confirmar o acesso.';
            return;
        }

        if (authMode === 'reset') {
            const redirectTo = window.location.href.split('#')[0];
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
            $('authMessage').innerText = error ? error.message : 'Enviamos o link de redefinicao para seu email.';
            return;
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            $('authMessage').innerText = error.message;
            return;
        }

        $('authMessage').innerText = 'Entrando...';

        if (data?.session) {
            window.setTimeout(() => {
                handleAuthState(data.session).catch((stateError) => {
                    console.error(stateError);
                    $('authMessage').innerText = stateError.message || 'Erro ao abrir sua conta.';
                });
            }, 0);
        }
    } finally {
        submitButton.disabled = false;
        submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
        submitButton.innerText = originalText;
    }
}

async function handleRecoverySubmit(event) {
    event.preventDefault();
    if (!supabaseClient) return;

    const password = $('recoveryPassword').value;
    const confirm = $('recoveryPasswordConfirm').value;
    if (!password || password !== confirm) {
        $('authMessage').innerText = 'As senhas nao conferem.';
        return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
        $('authMessage').innerText = error.message;
        return;
    }

    currentRecoveryMode = false;
    $('authMessage').innerText = 'Senha atualizada com sucesso. Entrando no app...';
    window.history.replaceState({}, document.title, window.location.pathname);
    await handleAuthState(currentSession);
}

async function logout() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
}

async function handleAuthState(session) {
    currentSession = session;

    if (currentRecoveryMode && session) {
        showAppShell(false);
        hideAllOverlays();
        $('authOverlay').classList.remove('hidden');
        showRecoveryForm();
        setLoading(false);
        return;
    }

    if (!session) {
        showAppShell(false);
        hideAllOverlays();
        $('authOverlay').classList.remove('hidden');
        switchAuthMode('login');
        setLoading(false);
        return;
    }

    try {
        const state = await loadRemoteState();
        if (state === 'ready') {
            hideAllOverlays();
            showAppShell(true);
        }
    } catch (error) {
        console.error(error);
        showToast('Erro ao carregar dados do usuario.');
        $('onboardingOverlay').classList.remove('hidden');
        showAppShell(false);
    } finally {
        setLoading(false);
    }
}

async function loadRemoteState() {
    if (!supabaseClient || !currentSession) return;

    currentHousehold = null;
    currentMembers = [];
    currentCards = [];

    const profileResult = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .maybeSingle();
    if (profileResult.error) throw profileResult.error;
    currentProfile = profileResult.data;

    const membershipResult = await supabaseClient
        .from('household_members')
        .select('*')
        .eq('user_id', currentSession.user.id)
        .eq('is_active', true)
        .order('sort_order');
    if (membershipResult.error) throw membershipResult.error;

    if (!membershipResult.data?.length || !currentProfile?.onboarding_completed) {
        showAppShell(false);
        $('authOverlay').classList.add('hidden');
        $('onboardingOverlay').classList.remove('hidden');
        prefFillOnboarding();
        return 'onboarding';
    }

    const householdId = membershipResult.data[0].household_id;
    const householdResult = await supabaseClient.from('households').select('*').eq('id', householdId).maybeSingle();
    if (householdResult.error) throw householdResult.error;

    const membersResult = await supabaseClient
        .from('household_members')
        .select('*')
        .eq('household_id', householdId)
        .order('sort_order');
    if (membersResult.error) throw membersResult.error;

    const cardsResult = await supabaseClient
        .from('cards')
        .select('*')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('name');
    if (cardsResult.error) throw cardsResult.error;

    const goalResult = await supabaseClient
        .from('savings_goals')
        .select('*')
        .eq('household_id', householdId)
        .limit(1)
        .maybeSingle();
    if (goalResult.error) throw goalResult.error;

    const expensesResult = await supabaseClient
        .from('expenses')
        .select('*')
        .eq('household_id', householdId)
        .order('occurred_on', { ascending: false });
    if (expensesResult.error) throw expensesResult.error;

    let preferenceRows = [];
    const activeMembers = membersResult.data.filter((member) => member.is_active);
    if (activeMembers.length) {
        const prefsResult = await supabaseClient
            .from('member_card_preferences')
            .select('*')
            .in('household_member_id', activeMembers.map((member) => member.id));
        if (prefsResult.error) throw prefsResult.error;
        preferenceRows = prefsResult.data || [];
    }

    currentHousehold = householdResult.data;
    currentMembers = activeMembers;
    currentCards = cardsResult.data || [];
    currentGoalId = goalResult.data?.id || null;

    appConfig = {
        appName: currentHousehold.name,
        householdType: currentHousehold.household_type,
        members: [
            { name: currentMembers[0]?.display_name || 'Pessoa 1', theme: 'bel' },
            { name: currentMembers[1]?.display_name || 'Pessoa 2', theme: 'luccas' }
        ]
    };
    householdTypeDraft = appConfig.householdType;

    meta = goalResult.data
        ? {
            ativa: goalResult.data.is_active,
            nome: goalResult.data.name || '',
            alvo: Number(goalResult.data.target_amount || 0),
            atual: Number(goalResult.data.current_amount || 0)
        }
        : { ...defaultMeta };

    cartoes = currentCards.map((card) => card.name);
    cartaoFavorito = {};
    preferenceRows.forEach((pref) => {
        const member = currentMembers.find((item) => item.id === pref.household_member_id);
        const card = currentCards.find((item) => item.id === pref.card_id);
        if (member && card) {
            cartaoFavorito[getFavoriteKeyByName(member.display_name)] = card.name;
        }
    });

    gastos = (expensesResult.data || []).map(makeUiExpense);
    pagadorAtual = getActiveMembers()[0]?.name || 'Pessoa 1';
    cartaoSelecionado = cartoes[0] || '';

    updateSyncUi();
    updateIdentityUI();
    renderEditPagadorOptions();
    renderPayerButtons();
    renderCategories();
    updateSeletorCartaoForm();
    setPayer(pagadorAtual);
    render();
    return 'ready';
}

function prefFillOnboarding() {
    $('onboardingAppName').value = currentProfile?.full_name ? `Casa ${currentProfile.full_name}` : 'Meu Pluri';
    $('onboardingPessoa1').value = currentProfile?.full_name || '';
    $('onboardingPessoa2').value = '';
    setOnboardingHouseholdType('couple');
    $('onboardingMessage').innerText = '';
}

async function handleOnboardingSubmit(event) {
    event.preventDefault();
    if (!supabaseClient || !currentSession) return;

    const appName = $('onboardingAppName').value.trim();
    const pessoa1 = $('onboardingPessoa1').value.trim();
    const pessoa2 = $('onboardingPessoa2').value.trim();

    if (!appName || !pessoa1 || (onboardingHouseholdType === 'couple' && !pessoa2)) {
        $('onboardingMessage').innerText = 'Preencha os campos obrigatorios.';
        return;
    }

    $('onboardingMessage').innerText = 'Criando estrutura inicial...';

    const { data, error } = await supabaseClient.rpc('create_household_with_members', {
        p_name: appName,
        p_household_type: onboardingHouseholdType,
        p_primary_name: pessoa1,
        p_secondary_name: onboardingHouseholdType === 'couple' ? pessoa2 : null
    });
    if (error) {
        $('onboardingMessage').innerText = error.message;
        return;
    }

    if (!data) {
        $('onboardingMessage').innerText = 'Nao foi possivel criar a casa.';
        return;
    }

    await loadRemoteState();
    hideAllOverlays();
    showAppShell(true);
}

function openConfigModal() {
    if (!currentHousehold) {
        showToast('A casa ainda nao foi carregada. Tente sincronizar e abrir novamente.');
        return;
    }

    $('editAppName').value = appConfig.appName;
    $('editPessoa1Nome').value = appConfig.members[0]?.name || '';
    $('editPessoa2Nome').value = appConfig.members[1]?.name || '';
    $('metaAtiva').checked = meta.ativa;
    $('editMetaNome').value = meta.nome;
    $('editMetaAlvo').value = meta.alvo;
    $('editMetaAtual').value = meta.atual;
    householdTypeDraft = appConfig.householdType;
    setHouseholdType(householdTypeDraft);
    renderListaCartoesConfig();
    toggleMetaInputs();
    openModal('modalConfig');
}

function renderListaCartoesConfig() {
    $('listaCartoesConfig').innerHTML = cartoes.map((name) => `
        <div class="config-chip px-3 py-2 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase">
            ${escapeHtml(name)} <button onclick='removeCartao(${quoteJs(name)})' class="text-red-500 ml-1">x</button>
        </div>
    `).join('');
    updateSeletorCartaoForm();
}

async function addCartao() {
    const nome = $('novoCartaoNome').value.trim();
    if (!nome || cartoes.includes(nome)) return;

    if (!supabaseClient || !currentHousehold) {
        cartoes.push(nome);
        $('novoCartaoNome').value = '';
        renderListaCartoesConfig();
        return;
    }

    const { error } = await supabaseClient.from('cards').insert({
        household_id: currentHousehold.id,
        name: nome,
        created_by: currentSession.user.id
    });
    if (error) {
        showToast(error.message);
        return;
    }

    $('novoCartaoNome').value = '';
    await loadRemoteState();
}

async function removeCartao(nome) {
    if (!supabaseClient || !currentHousehold) {
        cartoes = cartoes.filter((item) => item !== nome);
        renderListaCartoesConfig();
        return;
    }

    const target = currentCards.find((card) => card.name === nome);
    if (!target) return;

    const { error } = await supabaseClient.from('cards').delete().eq('id', target.id);
    if (error) {
        showToast(error.message);
        return;
    }
    await loadRemoteState();
}

function updateSeletorCartaoForm() {
    const dropdown = $('cartaoDropdown');
    const hiddenInput = $('tipoCartao');
    const textDisplay = $('cartaoSelecionadoText');

    if (!cartoes.includes(cartaoSelecionado)) cartaoSelecionado = cartoes[0] || '';

    dropdown.innerHTML = cartoes.map((name) => `
        <div class="cartao-option px-4 py-3 hover:bg-white/10 cursor-pointer text-sm font-medium transition-colors ${name === cartaoSelecionado ? 'selecionado' : ''}" data-value="${escapeHtml(name)}">
            ${escapeHtml(name)}
        </div>
    `).join('');

    dropdown.querySelectorAll('.cartao-option').forEach((option) => {
        option.onclick = () => {
            cartaoSelecionado = option.dataset.value;
            hiddenInput.value = cartaoSelecionado;
            textDisplay.innerText = cartaoSelecionado;
            toggleCartaoDropdown(false);
            updateSeletorCartaoForm();
        };
    });

    hiddenInput.value = cartaoSelecionado;
    textDisplay.innerText = cartaoSelecionado || 'Selecionar cartao';
}

function selecionarCartaoFavorito(pagador) {
    const favorito = cartaoFavorito[getFavoriteKeyByName(pagador)];
    if (favorito && cartoes.includes(favorito)) {
        cartaoSelecionado = favorito;
        $('tipoCartao').value = favorito;
        $('cartaoSelecionadoText').innerText = favorito;
        updateSeletorCartaoForm();
    }
}

async function salvarCartaoFavorito(pagador, cartao) {
    cartaoFavorito[getFavoriteKeyByName(pagador)] = cartao;

    if (!supabaseClient || !currentHousehold) return;

    const member = currentMembers.find((item) => item.display_name === pagador);
    const card = currentCards.find((item) => item.name === cartao);
    if (!member || !card) return;

    const existing = await supabaseClient
        .from('member_card_preferences')
        .select('id')
        .eq('household_member_id', member.id)
        .maybeSingle();

    const payload = {
        household_member_id: member.id,
        card_id: card.id,
        is_favorite: true
    };

    const query = existing.data?.id
        ? supabaseClient.from('member_card_preferences').update(payload).eq('id', existing.data.id)
        : supabaseClient.from('member_card_preferences').insert(payload);
    const { error } = await query;
    if (error) console.error(error);
}

function toggleCartaoDropdown(show) {
    const shouldShow = show === undefined ? $('cartaoDropdown').classList.contains('hidden') : show;
    $('cartaoDropdown').classList.toggle('hidden', !shouldShow);
    $('cartaoArrow').classList.toggle('rotate-180', shouldShow);
}

function toggleFiltroDropdown(show) {
    const shouldShow = show === undefined ? $('filtroDropdown').classList.contains('hidden') : show;
    $('filtroDropdown').classList.toggle('hidden', !shouldShow);
    $('filtroArrow').classList.toggle('rotate-180', shouldShow);
}

function setMetodo(metodo) {
    metodoPagamento = metodo;
    document.querySelectorAll('.chip-metodo').forEach((button) => button.classList.remove('active-chip'));
    const targetButton = Array.from(document.querySelectorAll('.chip-metodo')).find((button) => normalizeMetodo(button.textContent).includes(normalizeMetodo(metodo)));
    if (targetButton) targetButton.classList.add('active-chip');
    $('seletorCartao').classList.toggle('hidden', !isCartaoMetodo(metodo));
}

function setValorRapido(valor) {
    const input = $('valor');
    input.value = ((parseFloat(input.value) || 0) + valor).toFixed(2);
}

function limparValor() {
    $('valor').value = '';
    $('valor').focus();
}

function renderCategories() {
    const grid = $('categoryGrid');
    grid.innerHTML = '';
    categories.forEach((cat) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `category-chip p-2 rounded-2xl border flex flex-col items-center transition-all ${cat.id === categoriaSelecionada ? 'active-chip' : ''}`;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${cat.svg}</svg><span class="text-[7px] font-bold uppercase mt-1">${cat.id}</span>`;
        btn.onclick = () => {
            categoriaSelecionada = cat.id;
            document.querySelectorAll('.category-chip').forEach((el) => el.classList.remove('active-chip'));
            btn.classList.add('active-chip');
        };
        grid.appendChild(btn);
    });
}

async function handleExpenseSubmit(event) {
    event.preventDefault();
    if (!supabaseClient || !currentHousehold) {
        showToast('Configure o Supabase para salvar gastos.');
        return;
    }

    const btnSubmit = $('btnSubmit');
    const textoOriginal = btnSubmit.innerText;
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Salvando...';

    const occurredOn = $('dataGasto').value;
    const member = currentMembers.find((item) => item.display_name === pagadorAtual);
    const card = currentCards.find((item) => item.name === $('tipoCartao').value);

    const { data, error } = await supabaseClient
        .from('expenses')
        .insert({
            household_id: currentHousehold.id,
            member_id: member?.id,
            card_id: isCartaoMetodo(metodoPagamento) ? card?.id || null : null,
            amount: parseFloat($('valor').value),
            category: categoriaSelecionada,
            description: $('descricao').value.trim() || categoriaSelecionada,
            payment_method: getPaymentMethodForDb(),
            occurred_on: occurredOn,
            is_fixed: $('isFixo').checked,
            created_by: currentSession.user.id
        })
        .select()
        .single();

    btnSubmit.disabled = false;
    btnSubmit.innerText = textoOriginal;

    if (error) {
        showToast(error.message);
        return;
    }

    if (isCartaoMetodo(metodoPagamento) && card?.name) await salvarCartaoFavorito(pagadorAtual, card.name);

    gastos.unshift(makeUiExpense(data));
    render();
    event.target.reset();
    $('dataGasto').valueAsDate = new Date();
    setMetodo('PIX');
    updateSeletorCartaoForm();
    showToast('Gasto registrado!');
}

function confirmDelete(id) {
    deleteIdTemp = id;
    $('confirmDeleteBtn').disabled = false;
    $('confirmDeleteBtn').innerText = 'SIM';
    openModal('modalDelete');
}

async function handleDeleteConfirm() {
    if (!supabaseClient || !deleteIdTemp) return;

    const btn = $('confirmDeleteBtn');
    btn.disabled = true;
    btn.innerText = 'Excluindo...';

    const { error } = await supabaseClient.from('expenses').delete().eq('id', deleteIdTemp);
    if (error) {
        showToast(error.message);
        btn.disabled = false;
        btn.innerText = 'SIM';
        return;
    }

    gastos = gastos.filter((item) => item.id !== deleteIdTemp);
    closeModal('modalDelete');
    render();
}

async function forceSync() {
    if (!supabaseClient || !currentSession) return;
    setLoading(true, 'Sincronizando...');
    await loadRemoteState();
    setLoading(false);
    showToast('Dados atualizados.');
}

async function saveConfig() {
    const saveButton = Array.from(document.querySelectorAll('#modalConfig button')).find((button) => button.textContent.trim().toUpperCase().includes('SALVAR'));

    if (!supabaseClient) {
        showToast('Cliente do Supabase nao inicializado.');
        return;
    }

    if (!currentHousehold) {
        showToast('Nenhuma casa foi carregada para salvar as configuracoes.');
        return;
    }

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.classList.add('opacity-70', 'cursor-not-allowed');
        saveButton.innerText = 'Salvando...';
    }

    try {
        const primaryName = $('editPessoa1Nome').value.trim() || 'Pessoa 1';
        const secondaryName = $('editPessoa2Nome').value.trim() || 'Pessoa 2';
        const householdType = householdTypeDraft;

        const householdUpdate = await supabaseClient
            .from('households')
            .update({
                name: $('editAppName').value.trim() || 'Pluri',
                household_type: householdType
            })
            .eq('id', currentHousehold.id);
        if (householdUpdate.error) {
            showToast(householdUpdate.error.message);
            return;
        }

        const primaryMember = currentMembers[0];
        const secondaryMember = currentMembers[1];

        if (primaryMember) {
            const updatePrimary = await supabaseClient
                .from('household_members')
                .update({ display_name: primaryName, is_active: true, sort_order: 0 })
                .eq('id', primaryMember.id);
            if (updatePrimary.error) {
                showToast(updatePrimary.error.message);
                return;
            }
        }

        if (householdType === 'couple') {
            if (secondaryMember) {
                const updateSecondary = await supabaseClient
                    .from('household_members')
                    .update({ display_name: secondaryName, is_active: true, sort_order: 1 })
                    .eq('id', secondaryMember.id);
                if (updateSecondary.error) {
                    showToast(updateSecondary.error.message);
                    return;
                }
            } else {
                const insertSecondary = await supabaseClient.from('household_members').insert({
                    household_id: currentHousehold.id,
                    display_name: secondaryName,
                    role: 'member',
                    color_key: 'secondary',
                    sort_order: 1,
                    is_active: true
                });
                if (insertSecondary.error) {
                    showToast(insertSecondary.error.message);
                    return;
                }
            }
        } else if (secondaryMember) {
            const disableSecondary = await supabaseClient
                .from('household_members')
                .update({ display_name: secondaryName, is_active: false })
                .eq('id', secondaryMember.id);
            if (disableSecondary.error) {
                showToast(disableSecondary.error.message);
                return;
            }
        }

        meta = {
            ativa: $('metaAtiva').checked,
            nome: $('editMetaNome').value.trim(),
            alvo: parseFloat($('editMetaAlvo').value) || 0,
            atual: parseFloat($('editMetaAtual').value) || 0
        };

        if (currentGoalId) {
            const updateGoal = await supabaseClient
                .from('savings_goals')
                .update({
                    name: meta.nome || 'Meta',
                    target_amount: meta.alvo,
                    current_amount: meta.atual,
                    is_active: meta.ativa
                })
                .eq('id', currentGoalId);
            if (updateGoal.error) {
                showToast(updateGoal.error.message);
                return;
            }
        } else if (meta.nome || meta.alvo || meta.atual || meta.ativa) {
            const insertGoal = await supabaseClient
                .from('savings_goals')
                .insert({
                    household_id: currentHousehold.id,
                    name: meta.nome || 'Meta',
                    target_amount: meta.alvo,
                    current_amount: meta.atual,
                    is_active: meta.ativa
                })
                .select()
                .single();
            if (insertGoal.error) {
                showToast(insertGoal.error.message);
                return;
            }
            currentGoalId = insertGoal.data.id;
        }

        closeModal('modalConfig');
        await loadRemoteState();
        showToast('Configuracoes salvas!');
    } catch (error) {
        console.error('Erro inesperado ao salvar configuracoes:', error);
        showToast('Erro inesperado ao salvar configuracoes.');
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.classList.remove('opacity-70', 'cursor-not-allowed');
            saveButton.innerText = 'Salvar Tudo';
        }
    }
}

function toggleEditDropdown(tipo, show) {
    const suffix = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    const dropdown = $(`edit${suffix}Dropdown`);
    const arrow = $(`edit${suffix}Arrow`);
    const button = $(`btnEdit${suffix}`);
    const shouldShow = show === undefined ? dropdown.classList.contains('hidden') : show;

    ['Pagador', 'Categoria', 'Metodo', 'Cartao'].forEach((name) => {
        if (name.toLowerCase() !== tipo) {
            $(`edit${name}Dropdown`)?.classList.add('hidden');
            $(`edit${name}Arrow`)?.classList.remove('rotate-180');
        }
    });

    if (shouldShow && button) {
        const rect = button.getBoundingClientRect();
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom + 8}px`;
        dropdown.style.setProperty('--dropdown-width', `${rect.width}px`);
    }

    dropdown.classList.toggle('hidden', !shouldShow);
    arrow.classList.toggle('rotate-180', shouldShow);
}

function selectEditPagador(valor) {
    $('editPagador').value = valor;
    $('editPagadorText').innerText = valor;
    toggleEditDropdown('pagador', false);
    document.querySelectorAll('.edit-pagador-option').forEach((opt) => opt.classList.toggle('selecionado', opt.dataset.value === valor));
}

function selectEditCategoria(valor) {
    $('editCategoria').value = valor;
    $('editCategoriaText').innerText = valor;
    toggleEditDropdown('categoria', false);
    document.querySelectorAll('.edit-categoria-option').forEach((opt) => opt.classList.toggle('selecionado', opt.dataset.value === valor));
}

function selectEditMetodo(valor) {
    $('editMetodo').value = valor;
    $('editMetodoText').innerText = valor;
    toggleEditDropdown('metodo', false);
    document.querySelectorAll('.edit-metodo-option').forEach((opt) => {
        opt.classList.toggle('selecionado', normalizeMetodo(opt.dataset.value) === normalizeMetodo(valor));
    });
    toggleEditCartao();
}

function selectEditCartao(valor) {
    $('editCartao').value = valor;
    $('editCartaoText').innerText = valor;
    toggleEditDropdown('cartao', false);
    document.querySelectorAll('.edit-cartao-option').forEach((opt) => opt.classList.toggle('selecionado', opt.dataset.value === valor));
}

function toggleEditCartao() {
    if (isCartaoMetodo($('editMetodo').value)) {
        $('editCartaoContainer').classList.remove('hidden');
        $('editCartaoDropdown').innerHTML = cartoes.map((name) => `<div class="edit-cartao-option px-4 py-3 hover:bg-white/10 cursor-pointer text-sm font-medium transition-colors text-slate-300" data-value="${escapeHtml(name)}" onclick='selectEditCartao(${quoteJs(name)})'>${escapeHtml(name)}</div>`).join('');
    } else {
        $('editCartaoContainer').classList.add('hidden');
    }
}

function openEditModal(id) {
    const gasto = gastos.find((item) => item.id === id);
    if (!gasto) return;

    $('editId').value = gasto.id;
    $('editDescricao').value = gasto.descricao;
    $('editValor').value = gasto.valor;
    $('editData').value = gasto.dataRaw;
    selectEditPagador(gasto.pagador);
    selectEditCategoria(gasto.categoria);

    if (isCartaoMetodo(gasto.metodo)) {
        const option = Array.from(document.querySelectorAll('.edit-metodo-option')).find((item) => isCartaoMetodo(item.dataset.value));
        selectEditMetodo(option?.dataset.value || 'Cartao');
        setTimeout(() => selectEditCartao(gasto.metodo.trim()), 10);
    } else {
        selectEditMetodo('PIX');
    }

    openModal('modalEdit');
}

async function handleEditExpenseSubmit(event) {
    event.preventDefault();
    if (!supabaseClient) return;

    const id = $('editId').value;
    const member = currentMembers.find((item) => item.display_name === $('editPagador').value);
    const card = currentCards.find((item) => item.name === $('editCartao').value);
    const metodo = $('editMetodo').value;

    const { data, error } = await supabaseClient
        .from('expenses')
        .update({
            member_id: member?.id,
            card_id: isCartaoMetodo(metodo) ? card?.id || null : null,
            amount: parseFloat($('editValor').value),
            category: $('editCategoria').value,
            description: $('editDescricao').value.trim(),
            payment_method: isCartaoMetodo(metodo) ? 'credit_card' : 'pix',
            occurred_on: $('editData').value
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        showToast(error.message);
        return;
    }

    gastos = gastos.map((item) => item.id === id ? makeUiExpense(data) : item);
    gastos.sort((a, b) => new Date(b.dataRaw) - new Date(a.dataRaw));
    closeModal('modalEdit');
    render();
    showToast('Gasto editado!');
}

function render() {
    const lista = $('listaGastos');
    const filtro = $('filtroMes').value;
    const activeMembers = getActiveMembers();
    const totals = Object.fromEntries(activeMembers.map((member) => [member.name, 0]));

    lista.innerHTML = '';
    const filtrados = filtro === 'all' ? gastos : gastos.filter((item) => item.mes === filtro);

    filtrados.forEach((gasto) => {
        if (totals[gasto.pagador] !== undefined) totals[gasto.pagador] += gasto.valor;
        const isPrimary = getMemberTheme(gasto.pagador) === 'bel';

        lista.innerHTML += `
            <div class="expense-card p-3 lg:p-4 ${isPrimary ? 'border-[var(--bel)]' : 'border-[var(--luccas)]'}">
                <div class="hidden lg:flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <span class="w-2 h-2 rounded-full ${isPrimary ? 'bg-[var(--bel)]' : 'bg-[var(--luccas)]'}"></span>
                        <div>
                            <p class="font-bold text-xs expense-title">${escapeHtml(gasto.descricao)}</p>
                            <p class="text-[8px] font-bold uppercase tracking-wider expense-meta">${escapeHtml(gasto.pagador)} • ${escapeHtml(gasto.metodo)} • ${escapeHtml(gasto.dataDisplay)}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <p class="font-black text-xs ${isPrimary ? 'expense-amount-primary' : 'expense-amount-secondary'}">R$ ${gasto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <div class="flex items-center gap-2">
                            <button onclick='openEditModal(${quoteJs(gasto.id)})' class="ghost-icon-button hover:text-[var(--primary-strong)] transition-colors" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button onclick='confirmDelete(${quoteJs(gasto.id)})' class="ghost-icon-button hover:text-red-500" title="Excluir">x</button>
                        </div>
                    </div>
                </div>
                <div class="lg:hidden">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full ${isPrimary ? 'bg-[var(--bel)]' : 'bg-[var(--luccas)]'}"></span>
                            <span class="text-xs font-bold uppercase expense-secondary">${escapeHtml(gasto.pagador)}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button onclick='openEditModal(${quoteJs(gasto.id)})' class="ghost-icon-button hover:text-[var(--primary-strong)] active:scale-95 transition-all" title="Editar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button onclick='confirmDelete(${quoteJs(gasto.id)})' class="ghost-icon-button hover:text-red-400 active:scale-95 transition-all text-lg" title="Excluir">x</button>
                        </div>
                    </div>
                    <p class="font-bold text-base expense-title mb-3">${escapeHtml(gasto.descricao)}</p>
                    <div class="flex justify-between items-center">
                        <p class="text-xs font-medium expense-meta">${escapeHtml(gasto.metodo)} • ${escapeHtml(gasto.dataDisplay)}</p>
                        <p class="font-black text-base ${isPrimary ? 'expense-amount-primary' : 'expense-amount-secondary'}">R$ ${gasto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>
        `;
    });

    if (meta.ativa) {
        $('metaContainer').classList.remove('hidden');
        const progresso = meta.alvo > 0 ? Math.round((meta.atual / meta.alvo) * 100) : 0;
        $('labelMeta').innerText = `${meta.nome} (${progresso}%)`;
        $('barraMeta').style.width = `${Math.min(meta.alvo > 0 ? (meta.atual / meta.alvo) * 100 : 0, 100)}%`;
    } else {
        $('metaContainer').classList.add('hidden');
    }

    const totalGeral = filtrados.reduce((total, item) => total + item.valor, 0);
    $('totalGeral').innerText = `R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    $('totalMember0').innerText = `R$ ${(totals[activeMembers[0]?.name] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (activeMembers[1]) $('totalMember1').innerText = `R$ ${(totals[activeMembers[1].name] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    updateChart(activeMembers.map((member) => totals[member.name] || 0));
}

function updateChart(values) {
    const ctx = $('chartDivisao').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: values.length === 1 ? [values[0] || 1] : values.map((value) => value || 1),
                backgroundColor: values.length === 1 ? ['#FFD952'] : ['#FFD952', '#A855F7'],
                borderWidth: 0
            }]
        },
        options: {
            cutout: '75%',
            plugins: { tooltip: { enabled: false } }
        }
    });
}

function exportarRelatorio() {
    const filtro = $('filtroMes').value;
    const filtrados = filtro === 'all' ? gastos : gastos.filter((item) => item.mes === filtro);
    let txt = `RELATORIO FINANCEIRO ${appConfig.appName.toUpperCase()}\n===============================\n`;
    filtrados.forEach((gasto) => {
        txt += `${gasto.dataDisplay} | ${gasto.pagador} | ${gasto.metodo} | ${gasto.descricao}: R$ ${gasto.valor.toFixed(2)}\n`;
    });
    const blob = new Blob([txt], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${filtro}.txt`;
    link.click();
}

function bindUiEvents() {
    const btnSelectCartao = $('btnSelectCartao');
    const btnSelectFiltro = $('btnSelectFiltro');
    const customSelectCartao = $('customSelectCartao');
    const customSelectFiltro = $('customSelectFiltro');
    const authForm = $('authForm');
    const recoveryForm = $('recoveryForm');
    const onboardingForm = $('onboardingForm');
    const formGasto = $('formGasto');
    const formEditarGasto = $('formEditarGasto');
    const confirmDeleteBtn = $('confirmDeleteBtn');

    if (btnSelectCartao) {
        btnSelectCartao.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleCartaoDropdown();
        };
    }

    if (btnSelectFiltro) {
        btnSelectFiltro.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleFiltroDropdown();
        };
    }

    document.addEventListener('click', (event) => {
        if (customSelectCartao && !customSelectCartao.contains(event.target)) toggleCartaoDropdown(false);
        if (customSelectFiltro && !customSelectFiltro.contains(event.target)) toggleFiltroDropdown(false);
    });

    document.querySelectorAll('.filtro-option').forEach((option) => {
        option.onclick = () => {
            $('filtroMes').value = option.dataset.value;
            $('filtroSelecionadoText').innerText = option.innerText;
            toggleFiltroDropdown(false);
            render();
        };
    });

    if (authForm) authForm.addEventListener('submit', handleAuthSubmit);
    if (recoveryForm) recoveryForm.addEventListener('submit', handleRecoverySubmit);
    if (onboardingForm) onboardingForm.addEventListener('submit', handleOnboardingSubmit);
    if (formGasto) formGasto.addEventListener('submit', handleExpenseSubmit);
    if (formEditarGasto) formEditarGasto.addEventListener('submit', handleEditExpenseSubmit);
    if (confirmDeleteBtn) confirmDeleteBtn.onclick = handleDeleteConfirm;
}

async function bootstrap() {
    try {
        bindUiEvents();
        applyTheme(loadThemePreference());
        renderCategories();
        updateSyncUi();

        if (!isSupabaseConfigured()) {
            hideAllOverlays();
            $('setupNotice').classList.remove('hidden');
            showAppShell(false);
            setLoading(false);
            return;
        }

        supabaseClient = createSupabaseClient();
        updateSyncUi();

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        if (hashParams.get('type') === 'recovery') showRecoveryForm();

        supabaseClient.auth.onAuthStateChange((_event, session) => {
            window.setTimeout(async () => {
                try {
                    await handleAuthState(session);
                } catch (error) {
                    console.error(error);
                    showToast('Erro ao atualizar a sessao.');
                    setLoading(false);
                }
            }, 0);
        });

        const { data, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.error(error);
            showToast('Erro ao abrir a sessao.');
            setLoading(false);
            return;
        }

        await handleAuthState(data.session);
    } catch (error) {
        console.error(error);
        hideAllOverlays();
        showAppShell(false);
        showToast(`Erro ao iniciar o app: ${error.message || 'desconhecido'}`);
        setLoading(false);
    }
}

bootstrap();
