const categories = [
    { id: 'Comida', svg: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>' },
    { id: 'Lazer', svg: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="15" cy="13" r="1"/>' },
    { id: 'Mercado', svg: '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' },
    { id: 'Viagem', svg: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>' },
    { id: 'Outros', svg: '<circle cx="12" cy="12" r="3"/><path d="M3 12h3m12 0h3M12 3v3m0 12v3"/>' }
];

const APP_URL = 'https://pluri.netlify.app';

const monthLabels = {
    'pt-BR': ['Todos os Meses', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    'en-US': ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    'es-ES': ['Todos los meses', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
};

const categoryLabels = {
    'pt-BR': { Comida: 'Comida', Lazer: 'Lazer', Mercado: 'Mercado', Viagem: 'Viagem', Outros: 'Outros' },
    'en-US': { Comida: 'Food', Lazer: 'Fun', Mercado: 'Groceries', Viagem: 'Travel', Outros: 'Other' },
    'es-ES': { Comida: 'Comida', Lazer: 'Ocio', Mercado: 'Mercado', Viagem: 'Viaje', Outros: 'Otros' }
};

const defaultMemberColors = {
    primary: '#0e7490',
    secondary: '#ec4899'
};

const localeByLanguage = {
    'pt-BR': 'pt-BR',
    'en-US': 'en-US',
    'es-ES': 'es-ES'
};

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
        { name: 'Pessoa 1', theme: 'primary', color: '' },
        { name: 'Pessoa 2', theme: 'secondary', color: '' }
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
let currentLanguage = localStorage.getItem('pluri_language') || 'pt-BR';

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
    const labelMap = {
        'pt-BR': { dark: 'Tema Escuro', light: 'Tema Claro' },
        'en-US': { dark: 'Dark Theme', light: 'Light Theme' },
        'es-ES': { dark: 'Tema Oscuro', light: 'Tema Claro' }
    };
    const labels = labelMap[currentLanguage] || labelMap['pt-BR'];
    const nextLabel = currentThemeMode === 'dark' ? labels.dark : labels.light;
    document.querySelectorAll('.theme-toggle').forEach((button) => {
        button.setAttribute('aria-label', nextLabel);
        button.setAttribute('title', nextLabel);
    });
    document.querySelectorAll('.theme-toggle').forEach((button) => {
        button.classList.toggle('is-dark', currentThemeMode === 'dark');
    });
}

const translations = {
    'pt-BR': {
        heroTitle: 'Bem-vindo.',
        authModes: {
            login: {
                kicker: 'Acesse sua conta',
                title: 'Entrar no Pluri',
                subtitle: 'Sua area financeira segura e sincronizada.'
            },
            signup: {
                kicker: 'Comece seu controle',
                title: 'Criar conta no Pluri',
                subtitle: 'Monte seu espaco financeiro em poucos segundos.'
            },
            reset: {
                kicker: 'Recupere o acesso',
                title: 'Esqueci minha senha',
                subtitle: 'Informe seu email para receber o link de recuperacao.'
            }
        },
        login: 'Entrar',
        signup: 'Criar conta',
        reset: 'Recuperar',
        sendLink: 'Enviar link',
        createAccount: 'Criar conta',
        google: 'Continuar com Google',
        logoutConfirm: 'Tem certeza que deseja deslogar?',
        logoutTitle: 'Sair da conta?',
        logoutCancel: 'Continuar logado',
        logoutConfirmAction: 'Sim, sair',
        deleteAccountTitle: 'Apagar conta?',
        deleteAccountText: 'Essa acao remove sua conta e os dados vinculados a ela. Nao da para desfazer.',
        deleteAccountButton: 'Apagar conta',
        deleteAccountCancel: 'Cancelar',
        deleteAccountConfirm: 'Sim, apagar',
        deleteAccountMissingRpc: 'A funcao delete_my_account ainda nao existe no Supabase. Rode o SQL de apagar conta.',
        fixed: 'Fixo',
        installment: 'Parcelado',
        installmentsLabel: 'Parcelas',
        installmentsPlaceholder: 'Ex: 6',
        installmentHint: 'O valor informado sera repetido mensalmente por parcela.',
        installmentInvalid: 'Informe pelo menos 2 parcelas.',
        updatePassword: 'Atualizar senha',
        settingsKicker: 'Preferencias',
        settingsTitle: 'Configuracoes',
        languageLabel: 'Idioma',
        appProfileLabel: 'Perfil do App',
        savingsGoalLabel: 'Meta de Economia',
        activateGoal: 'Ativar Meta',
        myCardsLabel: 'Meus Cartoes',
        syncLabel: 'Sincronizacao',
        syncButton: 'Sincronizar com Planilha',
        close: 'Fechar',
        saveAll: 'Salvar Tudo',
        namePlaceholder: 'Seu nome',
        emailPlaceholder: 'voce@email.com',
        passwordPlaceholder: 'Sua senha',
        confirmPasswordPlaceholder: 'Confirmar senha',
        newPasswordPlaceholder: 'Nova senha',
        confirmNewPasswordPlaceholder: 'Confirmar nova senha',
        incomePlaceholder: 'Renda mensal',
        onboardingIncomeLabel: 'Renda mensal',
        onboardingIncomePlaceholder: 'Ex: 5000',
        appNamePlaceholder: 'Nome do app',
        memberOnePlaceholder: 'Pessoa 1',
        memberTwoPlaceholder: 'Pessoa 2',
        goalNamePlaceholder: 'Nome',
        goalTargetPlaceholder: 'Alvo R$',
        goalCurrentPlaceholder: 'Atual R$',
        totalGeneral: 'Gasto Geral',
        historyKicker: 'Historico',
        historyTitle: 'Seus lancamentos',
        historySubtitle: 'Navegue pelos registros com uma leitura mais limpa, rapida e confortavel.',
        newExpenseKicker: 'Novo gasto',
        newExpenseTitle: 'Adicionar lancamento',
        newExpenseSubtitle: 'Entrada rapida, categorias visuais e selecao de pagador sem atrito.',
        registerExpense: 'Registrar Gasto',
        descriptionPlaceholder: 'Descricao...',
        cardMethod: 'Cartao',
        selectCard: 'Selecionar cartao',
        noExpenses: 'Seus lancamentos vao aparecer aqui.',
        metaOff: 'Meta Off',
        saving: 'Salvando...',
        personOne: 'Pessoa 1',
        personTwo: 'Pessoa 2',
        edit: 'Editar',
        delete: 'Excluir',
        appHeaderKicker: 'Painel Pluri',
        appHeaderSubtitle: 'Seus gastos em um espaco mais claro, leve e agradavel de acompanhar.',
        home: 'Inicio',
        profile: 'Perfil',
        profileKicker: 'Conta',
        profileTitle: 'Meu perfil',
        profileSubtitle: 'Gerencie seus dados, renda e preferencias principais do Pluri.',
        profilePersonalData: 'Dados pessoais',
        profileSummary: 'Resumo da conta',
        profileEmail: 'Email',
        profileHousehold: 'Casa',
        profileIncome: 'Renda mensal',
        profileEntries: 'Lancamentos',
        profileCards: 'Cartoes',
        profileMembers: 'Pessoas',
        profileBack: 'Voltar ao painel',
        profileNameLabel: 'Nome',
        profileIncomeLabel: 'Renda mensal',
        profileSave: 'Salvar perfil',
        profileUpdated: 'Perfil atualizado.',
        summaryReadyTitle: 'Seu resumo financeiro esta pronto',
        summaryReadyText: 'Veja como seus gastos fecharam este mes e onde voce pode ajustar antes do proximo ciclo.',
        summaryOpen: 'Ver resumo',
        summaryTest: 'Testar resumo',
        summaryDismiss: 'Depois',
        summaryTitle: 'Resumo financeiro',
        summarySubtitle: 'Uma leitura rapida do seu mes atual.',
        summaryTotal: 'Total do mes',
        summaryAverage: 'Media por lancamento',
        summaryTopCategory: 'Maior categoria',
        summaryNoCategory: 'Sem categoria',
        summaryTransactions: 'Lancamentos',
        settings: 'Configuracoes',
        export: 'Exportar',
        logout: 'Sair',
        colorLabel: 'Cor',
        defaultColor: 'Padrao',
        useDefaultColor: 'Usar padrao',
        exportTitle: 'Exportar relatorio',
        exportSubtitle: 'Escolha o formato ideal para baixar ou compartilhar seus lancamentos filtrados.',
        exportCsv: 'Planilha CSV',
        exportTxt: 'Texto TXT',
        exportXls: 'Excel XLS',
        exportWhatsapp: 'WhatsApp',
        exportEmpty: 'Nao ha lancamentos para exportar.',
        exportReportHeading: 'RELATORIO FINANCEIRO',
        exportHeaderDate: 'Data',
        exportHeaderPayer: 'Pagador',
        exportHeaderCategory: 'Categoria',
        exportHeaderMethod: 'Metodo',
        exportHeaderDescription: 'Descricao',
        exportHeaderAmount: 'Valor'
    },
    'en-US': {
        heroTitle: 'Welcome.',
        authModes: {
            login: {
                kicker: 'Access your account',
                title: 'Sign in to Pluri',
                subtitle: 'Your secure and synced finance area.'
            },
            signup: {
                kicker: 'Start your control',
                title: 'Create your Pluri account',
                subtitle: 'Set up your finance space in a few seconds.'
            },
            reset: {
                kicker: 'Recover access',
                title: 'Forgot your password',
                subtitle: 'Enter your email to receive the recovery link.'
            }
        },
        login: 'Sign in',
        signup: 'Create account',
        reset: 'Recover',
        sendLink: 'Send link',
        createAccount: 'Create account',
        google: 'Continue with Google',
        logoutConfirm: 'Are you sure you want to sign out?',
        logoutTitle: 'Sign out?',
        logoutCancel: 'Stay signed in',
        logoutConfirmAction: 'Yes, sign out',
        deleteAccountTitle: 'Delete account?',
        deleteAccountText: 'This removes your account and linked data. This cannot be undone.',
        deleteAccountButton: 'Delete account',
        deleteAccountCancel: 'Cancel',
        deleteAccountConfirm: 'Yes, delete',
        deleteAccountMissingRpc: 'The delete_my_account function does not exist in Supabase yet. Run the delete account SQL.',
        fixed: 'Fixed',
        installment: 'Installment',
        installmentsLabel: 'Installments',
        installmentsPlaceholder: 'Ex: 6',
        installmentHint: 'The entered amount will repeat monthly per installment.',
        installmentInvalid: 'Enter at least 2 installments.',
        updatePassword: 'Update password',
        settingsKicker: 'Preferences',
        settingsTitle: 'Settings',
        languageLabel: 'Language',
        appProfileLabel: 'App Profile',
        savingsGoalLabel: 'Savings Goal',
        activateGoal: 'Activate Goal',
        myCardsLabel: 'My Cards',
        syncLabel: 'Sync',
        syncButton: 'Sync with Cloud',
        close: 'Close',
        saveAll: 'Save All',
        namePlaceholder: 'Your name',
        emailPlaceholder: 'you@email.com',
        passwordPlaceholder: 'Your password',
        confirmPasswordPlaceholder: 'Confirm password',
        newPasswordPlaceholder: 'New password',
        confirmNewPasswordPlaceholder: 'Confirm new password',
        incomePlaceholder: 'Monthly income',
        onboardingIncomeLabel: 'Monthly income',
        onboardingIncomePlaceholder: 'Ex: 5000',
        appNamePlaceholder: 'App name',
        memberOnePlaceholder: 'Person 1',
        memberTwoPlaceholder: 'Person 2',
        goalNamePlaceholder: 'Name',
        goalTargetPlaceholder: 'Target $',
        goalCurrentPlaceholder: 'Current $',
        totalGeneral: 'Total Spent',
        historyKicker: 'History',
        historyTitle: 'Your entries',
        historySubtitle: 'Browse your records with a cleaner, faster and more comfortable view.',
        newExpenseKicker: 'New expense',
        newExpenseTitle: 'Add entry',
        newExpenseSubtitle: 'Quick entry, visual categories and smooth payer selection.',
        registerExpense: 'Register Expense',
        descriptionPlaceholder: 'Description...',
        cardMethod: 'Card',
        selectCard: 'Select card',
        noExpenses: 'Your entries will appear here.',
        metaOff: 'Goal Off',
        saving: 'Saving...',
        personOne: 'Person 1',
        personTwo: 'Person 2',
        edit: 'Edit',
        delete: 'Delete',
        appHeaderKicker: 'Pluri Panel',
        appHeaderSubtitle: 'Track your expenses in a clearer, lighter and more pleasant space.',
        home: 'Home',
        profile: 'Profile',
        profileKicker: 'Account',
        profileTitle: 'My profile',
        profileSubtitle: 'Manage your data, income and main Pluri preferences.',
        profilePersonalData: 'Personal data',
        profileSummary: 'Account summary',
        profileEmail: 'Email',
        profileHousehold: 'Household',
        profileIncome: 'Monthly income',
        profileEntries: 'Entries',
        profileCards: 'Cards',
        profileMembers: 'People',
        profileBack: 'Back to dashboard',
        profileNameLabel: 'Name',
        profileIncomeLabel: 'Monthly income',
        profileSave: 'Save profile',
        profileUpdated: 'Profile updated.',
        summaryReadyTitle: 'Your financial summary is ready',
        summaryReadyText: 'See how your spending closed this month and where you can adjust before the next cycle.',
        summaryOpen: 'View summary',
        summaryTest: 'Test summary',
        summaryDismiss: 'Later',
        summaryTitle: 'Financial summary',
        summarySubtitle: 'A quick read of your current month.',
        summaryTotal: 'Month total',
        summaryAverage: 'Average per entry',
        summaryTopCategory: 'Top category',
        summaryNoCategory: 'No category',
        summaryTransactions: 'Entries',
        settings: 'Settings',
        export: 'Export',
        logout: 'Sign out',
        colorLabel: 'Color',
        defaultColor: 'Default',
        useDefaultColor: 'Use default',
        exportTitle: 'Export report',
        exportSubtitle: 'Choose the best format to download or share your filtered entries.',
        exportCsv: 'CSV spreadsheet',
        exportTxt: 'TXT text',
        exportXls: 'Excel XLS',
        exportWhatsapp: 'WhatsApp',
        exportEmpty: 'There are no entries to export.',
        exportReportHeading: 'FINANCIAL REPORT',
        exportHeaderDate: 'Date',
        exportHeaderPayer: 'Payer',
        exportHeaderCategory: 'Category',
        exportHeaderMethod: 'Method',
        exportHeaderDescription: 'Description',
        exportHeaderAmount: 'Amount'
    },
    'es-ES': {
        heroTitle: 'Bienvenido.',
        authModes: {
            login: {
                kicker: 'Accede a tu cuenta',
                title: 'Entrar en Pluri',
                subtitle: 'Tu area financiera segura y sincronizada.'
            },
            signup: {
                kicker: 'Empieza tu control',
                title: 'Crear cuenta en Pluri',
                subtitle: 'Configura tu espacio financiero en pocos segundos.'
            },
            reset: {
                kicker: 'Recupera el acceso',
                title: 'Olvide mi contrasena',
                subtitle: 'Informa tu email para recibir el enlace de recuperacion.'
            }
        },
        login: 'Entrar',
        signup: 'Crear cuenta',
        reset: 'Recuperar',
        sendLink: 'Enviar enlace',
        createAccount: 'Crear cuenta',
        google: 'Continuar con Google',
        logoutConfirm: 'Estas seguro de que quieres salir?',
        logoutTitle: 'Salir de la cuenta?',
        logoutCancel: 'Seguir conectado',
        logoutConfirmAction: 'Si, salir',
        deleteAccountTitle: 'Eliminar cuenta?',
        deleteAccountText: 'Esto elimina tu cuenta y los datos vinculados. No se puede deshacer.',
        deleteAccountButton: 'Eliminar cuenta',
        deleteAccountCancel: 'Cancelar',
        deleteAccountConfirm: 'Si, eliminar',
        deleteAccountMissingRpc: 'La funcion delete_my_account aun no existe en Supabase. Ejecuta el SQL para eliminar cuenta.',
        fixed: 'Fijo',
        installment: 'En cuotas',
        installmentsLabel: 'Cuotas',
        installmentsPlaceholder: 'Ej: 6',
        installmentHint: 'El valor informado se repetira mensualmente por cuota.',
        installmentInvalid: 'Informa al menos 2 cuotas.',
        updatePassword: 'Actualizar contrasena',
        settingsKicker: 'Preferencias',
        settingsTitle: 'Configuracion',
        languageLabel: 'Idioma',
        appProfileLabel: 'Perfil de la app',
        savingsGoalLabel: 'Meta de ahorro',
        activateGoal: 'Activar meta',
        myCardsLabel: 'Mis tarjetas',
        syncLabel: 'Sincronizacion',
        syncButton: 'Sincronizar con la nube',
        close: 'Cerrar',
        saveAll: 'Guardar todo',
        namePlaceholder: 'Tu nombre',
        emailPlaceholder: 'tu@email.com',
        passwordPlaceholder: 'Tu contrasena',
        confirmPasswordPlaceholder: 'Confirmar contrasena',
        newPasswordPlaceholder: 'Nueva contrasena',
        confirmNewPasswordPlaceholder: 'Confirmar nueva contrasena',
        incomePlaceholder: 'Ingreso mensual',
        onboardingIncomeLabel: 'Ingreso mensual',
        onboardingIncomePlaceholder: 'Ej: 5000',
        appNamePlaceholder: 'Nombre de la app',
        memberOnePlaceholder: 'Persona 1',
        memberTwoPlaceholder: 'Persona 2',
        goalNamePlaceholder: 'Nombre',
        goalTargetPlaceholder: 'Meta $',
        goalCurrentPlaceholder: 'Actual $',
        totalGeneral: 'Gasto total',
        historyKicker: 'Historial',
        historyTitle: 'Tus movimientos',
        historySubtitle: 'Navega tus registros con una lectura mas limpia, rapida y comoda.',
        newExpenseKicker: 'Nuevo gasto',
        newExpenseTitle: 'Agregar movimiento',
        newExpenseSubtitle: 'Entrada rapida, categorias visuales y seleccion de pagador sin friccion.',
        registerExpense: 'Registrar gasto',
        descriptionPlaceholder: 'Descripcion...',
        cardMethod: 'Tarjeta',
        selectCard: 'Seleccionar tarjeta',
        noExpenses: 'Tus movimientos apareceran aqui.',
        metaOff: 'Meta Off',
        saving: 'Guardando...',
        personOne: 'Persona 1',
        personTwo: 'Persona 2',
        edit: 'Editar',
        delete: 'Eliminar',
        appHeaderKicker: 'Panel Pluri',
        appHeaderSubtitle: 'Acompana tus gastos en un espacio mas claro, ligero y agradable.',
        home: 'Inicio',
        profile: 'Perfil',
        profileKicker: 'Cuenta',
        profileTitle: 'Mi perfil',
        profileSubtitle: 'Gestiona tus datos, ingresos y preferencias principales de Pluri.',
        profilePersonalData: 'Datos personales',
        profileSummary: 'Resumen de la cuenta',
        profileEmail: 'Email',
        profileHousehold: 'Casa',
        profileIncome: 'Ingreso mensual',
        profileEntries: 'Movimientos',
        profileCards: 'Tarjetas',
        profileMembers: 'Personas',
        profileBack: 'Volver al panel',
        profileNameLabel: 'Nombre',
        profileIncomeLabel: 'Ingreso mensual',
        profileSave: 'Guardar perfil',
        profileUpdated: 'Perfil actualizado.',
        summaryReadyTitle: 'Tu resumen financiero esta listo',
        summaryReadyText: 'Mira como cerraron tus gastos este mes y donde puedes ajustar antes del proximo ciclo.',
        summaryOpen: 'Ver resumen',
        summaryTest: 'Probar resumen',
        summaryDismiss: 'Luego',
        summaryTitle: 'Resumen financiero',
        summarySubtitle: 'Una lectura rapida de tu mes actual.',
        summaryTotal: 'Total del mes',
        summaryAverage: 'Promedio por movimiento',
        summaryTopCategory: 'Mayor categoria',
        summaryNoCategory: 'Sin categoria',
        summaryTransactions: 'Movimientos',
        settings: 'Configuracion',
        export: 'Exportar',
        logout: 'Salir',
        colorLabel: 'Color',
        defaultColor: 'Predeterminado',
        useDefaultColor: 'Usar predeterminado',
        exportTitle: 'Exportar informe',
        exportSubtitle: 'Elige el mejor formato para descargar o compartir tus movimientos filtrados.',
        exportCsv: 'Planilla CSV',
        exportTxt: 'Texto TXT',
        exportXls: 'Excel XLS',
        exportWhatsapp: 'WhatsApp',
        exportEmpty: 'No hay movimientos para exportar.',
        exportReportHeading: 'INFORME FINANCIERO',
        exportHeaderDate: 'Fecha',
        exportHeaderPayer: 'Pagador',
        exportHeaderCategory: 'Categoria',
        exportHeaderMethod: 'Metodo',
        exportHeaderDescription: 'Descripcion',
        exportHeaderAmount: 'Valor'
    }
};

function getAuthModeCopy(text) {
    return text.authModes?.[authMode] || text.authModes?.login || {};
}

function getCurrentMonths() {
    return monthLabels[currentLanguage] || monthLabels['pt-BR'];
}

function getCurrentLocale() {
    return localeByLanguage[currentLanguage] || 'pt-BR';
}

function getDisplayMemberName(name) {
    const text = translations[currentLanguage] || translations['pt-BR'];
    if (name === 'Pessoa 1' || name === 'Person 1' || name === 'Persona 1') return text.personOne;
    if (name === 'Pessoa 2' || name === 'Person 2' || name === 'Persona 2') return text.personTwo;
    return name;
}

function getCategoryLabel(id) {
    const labels = categoryLabels[currentLanguage] || categoryLabels['pt-BR'];
    return labels[id] || id;
}

function updateMonthFilterLabels() {
    const months = getCurrentMonths();
    document.querySelectorAll('.filtro-option').forEach((option) => {
        const value = option.dataset.value;
        const index = value === 'all' ? 0 : Number(value);
        option.innerText = months[index] || option.innerText;
    });
    const selected = $('filtroMes')?.value || 'all';
    const selectedIndex = selected === 'all' ? 0 : Number(selected);
    if ($('filtroSelecionadoText')) $('filtroSelecionadoText').innerText = months[selectedIndex] || months[0];
}

function setLanguage(language) {
    currentLanguage = translations[language] ? language : 'pt-BR';
    localStorage.setItem('pluri_language', currentLanguage);
    const text = translations[currentLanguage];
    const authCopy = getAuthModeCopy(text);

    if ($('languageSelect')) $('languageSelect').value = currentLanguage;
    document.querySelectorAll('.language-option').forEach((option) => {
        const active = option.dataset.value === currentLanguage;
        option.classList.toggle('active', active);
        if (active && $('languageSelectText')) $('languageSelectText').innerText = option.dataset.label || option.innerText.trim();
    });
    updateThemeLabels();
    if ($('authHeroTitle')) $('authHeroTitle').innerText = text.heroTitle;
    if ($('authKicker')) $('authKicker').innerText = authCopy.kicker || '';
    if ($('authTitle')) $('authTitle').innerText = authCopy.title || '';
    if ($('authSubtitle')) $('authSubtitle').innerText = authCopy.subtitle || '';
    if ($('tabLogin')) $('tabLogin').innerText = text.login;
    if ($('tabSignup')) $('tabSignup').innerText = text.signup;
    if ($('tabReset')) $('tabReset').innerText = text.reset;
    if ($('authLangPt')) $('authLangPt').classList.toggle('active', currentLanguage === 'pt-BR');
    if ($('authLangEn')) $('authLangEn').classList.toggle('active', currentLanguage === 'en-US');
    if ($('googleAuthLabel')) $('googleAuthLabel').innerText = text.google;
    if ($('recoverySubmitBtn')) $('recoverySubmitBtn').innerText = text.updatePassword;
    if ($('fixedLabel')) $('fixedLabel').innerText = text.fixed;
    if ($('installmentLabel')) $('installmentLabel').innerText = text.installment;
    if ($('installmentsFieldLabel')) $('installmentsFieldLabel').innerText = text.installmentsLabel;
    if ($('installmentsCount')) $('installmentsCount').placeholder = text.installmentsPlaceholder;
    if ($('installmentHint')) $('installmentHint').innerText = text.installmentHint;
    if ($('settingsKicker')) $('settingsKicker').innerText = text.settingsKicker;
    if ($('settingsTitle')) $('settingsTitle').innerText = text.settingsTitle;
    if ($('settingsLanguageLabel')) $('settingsLanguageLabel').innerText = text.languageLabel;
    if ($('settingsAppProfileLabel')) $('settingsAppProfileLabel').innerText = text.appProfileLabel;
    if ($('settingsGoalLabel')) $('settingsGoalLabel').innerText = text.savingsGoalLabel;
    if ($('settingsActivateGoalLabel')) $('settingsActivateGoalLabel').innerText = text.activateGoal;
    if ($('settingsCardsLabel')) $('settingsCardsLabel').innerText = text.myCardsLabel;
    if ($('settingsCloseBtn')) $('settingsCloseBtn').innerText = text.close;
    if ($('settingsSaveBtn')) $('settingsSaveBtn').innerText = text.saveAll;
    if ($('deleteAccountSettingsBtn')) $('deleteAccountSettingsBtn').innerText = text.deleteAccountButton;
    if ($('authName')) $('authName').placeholder = text.namePlaceholder;
    if ($('authEmail')) $('authEmail').placeholder = text.emailPlaceholder;
    if ($('authPassword')) $('authPassword').placeholder = text.passwordPlaceholder;
    if ($('authPasswordConfirm')) $('authPasswordConfirm').placeholder = text.confirmPasswordPlaceholder;
    if ($('authIncome')) $('authIncome').placeholder = text.incomePlaceholder;
    if ($('profileFullName')) $('profileFullName').placeholder = text.namePlaceholder;
    if ($('profileMonthlyIncome')) $('profileMonthlyIncome').placeholder = text.onboardingIncomePlaceholder;
    if ($('recoveryPassword')) $('recoveryPassword').placeholder = text.newPasswordPlaceholder;
    if ($('recoveryPasswordConfirm')) $('recoveryPasswordConfirm').placeholder = text.confirmNewPasswordPlaceholder;
    if ($('onboardingIncomeLabel')) $('onboardingIncomeLabel').innerText = text.onboardingIncomeLabel;
    if ($('onboardingIncome')) $('onboardingIncome').placeholder = text.onboardingIncomePlaceholder;
    if ($('editAppName')) $('editAppName').placeholder = text.appNamePlaceholder;
    if ($('editPessoa1Nome')) $('editPessoa1Nome').placeholder = text.memberOnePlaceholder;
    if ($('editPessoa2Nome')) $('editPessoa2Nome').placeholder = text.memberTwoPlaceholder;
    if ($('editMetaNome')) $('editMetaNome').placeholder = text.goalNamePlaceholder;
    if ($('editMetaAlvo')) $('editMetaAlvo').placeholder = text.goalTargetPlaceholder;
    if ($('editMetaAtual')) $('editMetaAtual').placeholder = text.goalCurrentPlaceholder;
    if ($('totalGeneralLabel')) $('totalGeneralLabel').innerText = text.totalGeneral;
    if ($('historyKicker')) $('historyKicker').innerText = text.historyKicker;
    if ($('historyTitle')) $('historyTitle').innerText = text.historyTitle;
    if ($('historySubtitle')) $('historySubtitle').innerText = text.historySubtitle;
    if ($('newExpenseKicker')) $('newExpenseKicker').innerText = text.newExpenseKicker;
    if ($('newExpenseTitle')) $('newExpenseTitle').innerText = text.newExpenseTitle;
    if ($('newExpenseSubtitle')) $('newExpenseSubtitle').innerText = text.newExpenseSubtitle;
    if ($('btnSubmit')) $('btnSubmit').innerText = text.registerExpense;
    if ($('descricao')) $('descricao').placeholder = text.descriptionPlaceholder;
    if ($('met-Cartao')) $('met-Cartao').innerText = text.cardMethod.toUpperCase();
    if ($('cartaoSelecionadoText') && !$('tipoCartao')?.value) $('cartaoSelecionadoText').innerText = text.selectCard;
    document.documentElement.style.setProperty('--empty-expenses-text', `"${text.noExpenses}"`);
    if ($('labelMeta') && !$('metaAtiva')?.checked) $('labelMeta').innerText = text.metaOff;
    updateMonthFilterLabels();
    renderCategories();
    if ($('appShell') && !$('appShell').classList.contains('hidden')) {
        updateIdentityUI();
        renderPayerButtons();
        updateSeletorCartaoForm();
        render();
    }
    if ($('appHeaderKicker')) $('appHeaderKicker').innerText = text.appHeaderKicker;
    if ($('appHeaderSubtitle')) $('appHeaderSubtitle').innerText = text.appHeaderSubtitle;
    if ($('mobileMenuHome')) $('mobileMenuHome').innerText = text.home;
    if ($('mobileMenuProfile')) $('mobileMenuProfile').innerText = text.profile;
    if ($('mobileMenuSettings')) $('mobileMenuSettings').innerText = text.settings;
    if ($('mobileMenuExport')) $('mobileMenuExport').innerText = text.export;
    if ($('mobileMenuLogout')) $('mobileMenuLogout').innerText = text.logout;
    if ($('menuProfile')) $('menuProfile').innerText = text.profile;
    if ($('profilePageKicker')) $('profilePageKicker').innerText = text.profileKicker;
    if ($('profilePageTitle')) $('profilePageTitle').innerText = text.profileTitle;
    if ($('profilePageSubtitle')) $('profilePageSubtitle').innerText = text.profileSubtitle;
    if ($('profilePersonalDataTitle')) $('profilePersonalDataTitle').innerText = text.profilePersonalData;
    if ($('profileSummaryTitle')) $('profileSummaryTitle').innerText = text.profileSummary;
    if ($('profileEmailLabel')) $('profileEmailLabel').innerText = text.profileEmail;
    if ($('profileHouseholdLabel')) $('profileHouseholdLabel').innerText = text.profileHousehold;
    if ($('profileIncomeStatLabel')) $('profileIncomeStatLabel').innerText = text.profileIncome;
    if ($('profileEntriesLabel')) $('profileEntriesLabel').innerText = text.profileEntries;
    if ($('profileCardsLabel')) $('profileCardsLabel').innerText = text.profileCards;
    if ($('profileMembersLabel')) $('profileMembersLabel').innerText = text.profileMembers;
    if ($('profileBackBtn')) $('profileBackBtn').innerText = text.profileBack;
    if ($('profileNameLabel')) $('profileNameLabel').innerText = text.profileNameLabel;
    if ($('profileIncomeLabel')) $('profileIncomeLabel').innerText = text.profileIncomeLabel;
    if ($('profileSaveBtn')) $('profileSaveBtn').innerText = text.profileSave;
    if ($('summaryReadyTitle')) $('summaryReadyTitle').innerText = text.summaryReadyTitle;
    if ($('summaryReadyText')) $('summaryReadyText').innerText = text.summaryReadyText;
    if ($('summaryOpenBtn')) $('summaryOpenBtn').innerText = text.summaryOpen;
    if ($('summaryTestBtn')) $('summaryTestBtn').innerText = text.summaryTest;
    if ($('summaryDismissBtn')) $('summaryDismissBtn').innerText = text.summaryDismiss;
    if ($('summaryModalTitle')) $('summaryModalTitle').innerText = text.summaryTitle;
    if ($('summaryModalSubtitle')) $('summaryModalSubtitle').innerText = text.summarySubtitle;
    if ($('summaryTotalLabel')) $('summaryTotalLabel').innerText = text.summaryTotal;
    if ($('summaryAverageLabel')) $('summaryAverageLabel').innerText = text.summaryAverage;
    if ($('summaryTopCategoryLabel')) $('summaryTopCategoryLabel').innerText = text.summaryTopCategory;
    if ($('summaryTransactionsLabel')) $('summaryTransactionsLabel').innerText = text.summaryTransactions;
    if ($('menuSettings')) $('menuSettings').innerText = text.settings;
    if ($('menuExport')) $('menuExport').innerText = text.export;
    if ($('menuLogout')) $('menuLogout').innerText = text.logout;
    if ($('logoutModalTitle')) $('logoutModalTitle').innerText = text.logoutTitle;
    if ($('logoutModalText')) $('logoutModalText').innerText = text.logoutConfirm;
    if ($('logoutModalCancel')) $('logoutModalCancel').innerText = text.logoutCancel;
    if ($('logoutModalConfirm')) $('logoutModalConfirm').innerText = text.logoutConfirmAction;
    if ($('deleteAccountModalTitle')) $('deleteAccountModalTitle').innerText = text.deleteAccountTitle;
    if ($('deleteAccountModalText')) $('deleteAccountModalText').innerText = text.deleteAccountText;
    if ($('deleteAccountModalCancel')) $('deleteAccountModalCancel').innerText = text.deleteAccountCancel;
    if ($('deleteAccountModalConfirm')) $('deleteAccountModalConfirm').innerText = text.deleteAccountConfirm;
    if ($('person1ColorLabel')) $('person1ColorLabel').innerText = text.colorLabel;
    if ($('person2ColorLabel')) $('person2ColorLabel').innerText = text.colorLabel;
    if ($('person1ColorDefaultBtn')) $('person1ColorDefaultBtn').innerText = text.useDefaultColor;
    if ($('person2ColorDefaultBtn')) $('person2ColorDefaultBtn').innerText = text.useDefaultColor;
    if ($('exportModalKicker')) $('exportModalKicker').innerText = text.export;
    if ($('exportModalTitle')) $('exportModalTitle').innerText = text.exportTitle;
    if ($('exportModalSubtitle')) $('exportModalSubtitle').innerText = text.exportSubtitle;
    if ($('exportCsvLabel')) $('exportCsvLabel').innerText = text.exportCsv;
    if ($('exportTxtLabel')) $('exportTxtLabel').innerText = text.exportTxt;
    if ($('exportXlsLabel')) $('exportXlsLabel').innerText = text.exportXls;
    if ($('exportWhatsappLabel')) $('exportWhatsappLabel').innerText = text.exportWhatsapp;
    if ($('headerExportLabel')) $('headerExportLabel').innerText = text.export;
    if ($('headerSettingsLabel')) $('headerSettingsLabel').innerText = text.settings;
    if ($('logoutButton')) $('logoutButton').innerText = text.logout;
    if ($('authSubmitBtn')) {
        $('authSubmitBtn').innerText = authMode === 'signup' ? text.createAccount : authMode === 'reset' ? text.sendLink : text.login;
    }
    updateColorPickerLabels();
}

function toggleLanguageDropdown(force) {
    const select = $('languageSelectWrap');
    if (!select) return;
    const shouldOpen = force === undefined ? !select.classList.contains('open') : Boolean(force);
    select.classList.toggle('open', shouldOpen);
}

function selectLanguageOption(language) {
    setLanguage(language);
    toggleLanguageDropdown(false);
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
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString(getCurrentLocale(), { day: '2-digit', month: 'short' });
}

function formatDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addMonthsToDate(dateStr, monthsToAdd) {
    const [year, month, day] = String(dateStr).split('-').map(Number);
    const targetMonthIndex = (month - 1) + monthsToAdd;
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
    const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
    return formatDateInputValue(new Date(targetYear, normalizedMonth, Math.min(day, lastDay)));
}

function createGroupId() {
    return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerText = msg;
    $('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function openModal(id) {
    const modal = $(id);
    modal.style.display = 'flex';
    if (modal.classList.contains('settings-page')) {
        requestAnimationFrame(() => modal.classList.add('is-open'));
    }
}

function closeModal(id) {
    const modal = $(id);
    if (!modal) return;
    if (modal.classList.contains('settings-page')) {
        modal.classList.remove('is-open');
        window.setTimeout(() => {
            if (!modal.classList.contains('is-open')) modal.style.display = 'none';
        }, 180);
        setMobileNavActive(getCurrentNavTarget());
        return;
    }
    modal.style.display = 'none';
    if (['modalExport', 'modalLogout'].includes(id)) setMobileNavActive(getCurrentNavTarget());
}

function getCurrentNavTarget() {
    return $('profilePage') && !$('profilePage').classList.contains('hidden') ? 'profile' : 'home';
}

function closeAppOverlays(exceptId = '') {
    ['modalConfig', 'modalExport', 'modalMonthlySummary', 'modalEdit', 'modalDelete', 'modalLogout', 'modalDeleteAccount'].forEach((id) => {
        if (id !== exceptId && $(id)) closeModal(id);
    });
    toggleLanguageDropdown(false);
    toggleAppMenu(false);
}

function setMobileNavActive(target) {
    document.querySelectorAll('.mobile-bottom-item').forEach((item) => {
        item.classList.toggle('is-active', item.dataset.nav === target);
    });
}

function toggleAppMenu(force) {
    const menu = $('appMenu');
    if (!menu) return;
    const shouldOpen = force === undefined ? !menu.classList.contains('open') : Boolean(force);
    menu.classList.toggle('open', shouldOpen);
    const trigger = menu.querySelector('.menu-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function openProfileModal() {
    closeAppOverlays();
    setMobileNavActive('profile');
    updateProfilePage();
    if ($('profileMessage')) $('profileMessage').innerText = '';
    if ($('dashboardPage')) $('dashboardPage').classList.add('hidden');
    if ($('profilePage')) $('profilePage').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDashboardPage() {
    closeAppOverlays();
    setMobileNavActive('home');
    if ($('profilePage')) $('profilePage').classList.add('hidden');
    if ($('dashboardPage')) $('dashboardPage').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProfilePage() {
    const text = translations[currentLanguage] || translations['pt-BR'];
    const activeMembers = getActiveMembers();
    const fullName = currentProfile?.full_name || activeMembers[0]?.name || text.personOne;
    const email = currentSession?.user?.email || '-';
    const income = Number(currentProfile?.monthly_income || 0);

    if ($('profileAvatarInitials')) {
        $('profileAvatarInitials').innerText = String(fullName)
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase() || 'P';
    }
    if ($('profileDisplayName')) $('profileDisplayName').innerText = fullName;
    if ($('profileDisplayEmail')) $('profileDisplayEmail').innerText = email;
    if ($('profileEmail')) $('profileEmail').innerText = email;
    if ($('profileHousehold')) $('profileHousehold').innerText = currentHousehold?.name || appConfig.appName || '-';
    if ($('profileIncomeStat')) $('profileIncomeStat').innerText = `R$ ${income.toLocaleString(getCurrentLocale(), { minimumFractionDigits: 2 })}`;
    if ($('profileEntriesCount')) $('profileEntriesCount').innerText = String(gastos.length);
    if ($('profileCardsCount')) $('profileCardsCount').innerText = String(cartoes.length);
    if ($('profileMembersCount')) $('profileMembersCount').innerText = String(activeMembers.length);
    if ($('profileFullName')) $('profileFullName').value = currentProfile?.full_name || '';
    if ($('profileMonthlyIncome')) $('profileMonthlyIncome').value = currentProfile?.monthly_income || '';
    if ($('profileMonthlyBudget')) {
        const totalMonth = getCurrentMonthExpenses().reduce((total, item) => total + item.valor, 0);
        const percent = income > 0 ? Math.min((totalMonth / income) * 100, 100) : 0;
        $('profileMonthlyBudget').style.width = `${percent}%`;
    }
}

function getCurrentMonthKey() {
    return String(new Date().getMonth() + 1).padStart(2, '0');
}

function getCurrentMonthExpenses() {
    return gastos.filter((item) => item.mes === getCurrentMonthKey());
}

function getMonthlySummaryData() {
    const currentMonthExpenses = getCurrentMonthExpenses();
    const total = currentMonthExpenses.reduce((sum, item) => sum + item.valor, 0);
    const average = currentMonthExpenses.length ? total / currentMonthExpenses.length : 0;
    const byCategory = {};
    currentMonthExpenses.forEach((item) => {
        byCategory[item.categoria] = (byCategory[item.categoria] || 0) + item.valor;
    });
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    return {
        expenses: currentMonthExpenses,
        total,
        average,
        topCategoryName: topCategory?.[0] || '',
        topCategoryTotal: topCategory?.[1] || 0
    };
}

function shouldShowMonthlySummaryNotice() {
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return today.getDate() >= 25 && localStorage.getItem('pluri_summary_dismissed') !== monthKey;
}

function updateMonthlySummaryNotice() {
    const notice = $('monthlySummaryNotice');
    if (!notice) return;
    const summary = getMonthlySummaryData();
    notice.classList.toggle('hidden', !shouldShowMonthlySummaryNotice() || !summary.expenses.length);
}

function dismissMonthlySummaryNotice() {
    const today = new Date();
    localStorage.setItem('pluri_summary_dismissed', `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    updateMonthlySummaryNotice();
}

function openMonthlySummary() {
    const text = translations[currentLanguage] || translations['pt-BR'];
    const summary = getMonthlySummaryData();
    const currency = (value) => `R$ ${Number(value || 0).toLocaleString(getCurrentLocale(), { minimumFractionDigits: 2 })}`;
    if ($('summaryTotalValue')) $('summaryTotalValue').innerText = currency(summary.total);
    if ($('summaryAverageValue')) $('summaryAverageValue').innerText = currency(summary.average);
    if ($('summaryTopCategoryValue')) $('summaryTopCategoryValue').innerText = summary.topCategoryName
        ? `${getCategoryLabel(summary.topCategoryName)} · ${currency(summary.topCategoryTotal)}`
        : text.summaryNoCategory;
    if ($('summaryTransactionsValue')) $('summaryTransactionsValue').innerText = String(summary.expenses.length);
    if ($('summaryBars')) {
        const max = Math.max(...summary.expenses.map((item) => item.valor), 1);
        $('summaryBars').innerHTML = summary.expenses.slice(0, 8).map((item) => `
            <div class="summary-bar-item">
                <span style="height:${Math.max((item.valor / max) * 100, 8)}%"></span>
            </div>
        `).join('');
    }
    openModal('modalMonthlySummary');
}

function setLoading(visible, text = 'Carregando...') {
    const loading = $('loading');
    if (!loading) return;
    loading.style.display = visible ? 'flex' : 'none';
    const label = loading.querySelector('.loading-text');
    if (label) label.innerText = text;
}

function hideAllOverlays() {
    $('setupNotice').classList.add('hidden');
    $('authOverlay').classList.add('hidden');
    $('onboardingOverlay').classList.add('hidden');
}

function showAppShell(show) {
    $('appShell').classList.toggle('hidden', !show);
    if (!show) {
        if ($('profilePage')) $('profilePage').classList.add('hidden');
        if ($('dashboardPage')) $('dashboardPage').classList.remove('hidden');
    }
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
    return index === 1 ? 'secondary' : 'primary';
}

function normalizeHexColor(value) {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '';
}

function getMemberColorByTheme(theme) {
    const member = appConfig.members.find((item) => item.theme === theme);
    return normalizeHexColor(member?.color) || defaultMemberColors[theme] || defaultMemberColors.primary;
}

function getReadableTextColor(hexColor) {
    const color = normalizeHexColor(hexColor);
    if (!color) return '#ffffff';
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
    return luminance > 160 ? '#102033' : '#ffffff';
}

function getMemberColorFieldIds(theme) {
    const isSecondary = theme === 'secondary';
    return {
        hidden: isSecondary ? 'editPessoa2Cor' : 'editPessoa1Cor',
        picker: isSecondary ? 'editPessoa2CorPicker' : 'editPessoa1CorPicker',
        text: isSecondary ? 'editPessoa2CorText' : 'editPessoa1CorText'
    };
}

function setMemberColorInput(theme, color) {
    const ids = getMemberColorFieldIds(theme);
    const customColor = normalizeHexColor(color);
    const fallbackColor = defaultMemberColors[theme] || defaultMemberColors.primary;
    if ($(ids.hidden)) $(ids.hidden).value = customColor;
    if ($(ids.picker)) $(ids.picker).value = customColor || fallbackColor;
    if ($(ids.text)) {
        const text = translations[currentLanguage] || translations['pt-BR'];
        $(ids.text).innerText = customColor || text.defaultColor;
    }
}

function syncMemberColorInputs() {
    setMemberColorInput('primary', appConfig.members[0]?.color);
    setMemberColorInput('secondary', appConfig.members[1]?.color);
}

function setMemberColorDraft(theme, value) {
    setMemberColorInput(theme, value);
}

function clearMemberColorDraft(theme) {
    setMemberColorInput(theme, '');
}

function updateColorPickerLabels() {
    const text = translations[currentLanguage] || translations['pt-BR'];
    ['primary', 'secondary'].forEach((theme) => {
        const ids = getMemberColorFieldIds(theme);
        if ($(ids.text) && !normalizeHexColor($(ids.hidden)?.value)) {
            $(ids.text).innerText = text.defaultColor;
        }
    });
}

function isMissingCustomColorColumn(error) {
    const message = String(error?.message || '');
    return message.includes('custom_color') && message.includes('schema cache');
}

async function persistMemberConfig(member, payload) {
    if (!member) return { error: null };
    const { custom_color: customColor, ...fallbackPayload } = payload;
    const result = await supabaseClient
        .from('household_members')
        .update(payload)
        .eq('id', member.id);
    if (!result.error || !isMissingCustomColorColumn(result.error)) return result;

    showToast('A coluna custom_color ainda nao existe no Supabase. Salvando sem a cor por enquanto.');
    return supabaseClient
        .from('household_members')
        .update(fallbackPayload)
        .eq('id', member.id);
}

async function insertMemberConfig(payload) {
    const { custom_color: customColor, ...fallbackPayload } = payload;
    const result = await supabaseClient.from('household_members').insert(payload);
    if (!result.error || !isMissingCustomColorColumn(result.error)) return result;

    showToast('A coluna custom_color ainda nao existe no Supabase. Salvando sem a cor por enquanto.');
    return supabaseClient.from('household_members').insert(fallbackPayload);
}

function applyMemberColors() {
    const primary = getMemberColorByTheme('primary');
    const secondary = getMemberColorByTheme('secondary');
    const primaryText = getReadableTextColor(primary);
    const secondaryText = getReadableTextColor(secondary);
    document.documentElement.style.setProperty('--member-primary', primary);
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--primary-strong', primary);
    document.documentElement.style.setProperty('--member-primary-text-contrast', primaryText);
    document.documentElement.style.setProperty('--member-secondary-color', secondary);
    document.documentElement.style.setProperty('--member-secondary', secondary);
    document.documentElement.style.setProperty('--secondary', secondary);
    document.documentElement.style.setProperty('--member-secondary-text-contrast', secondaryText);
}

function getThemeStyles(theme) {
    const color = getMemberColorByTheme(theme === 'secondary' ? 'secondary' : 'primary');
    return theme === 'secondary'
        ? { bodyClass: 'secondary-theme', colorVar: color, textColor: getReadableTextColor(color), buttonClass: 'member-secondary-bg' }
        : { bodyClass: 'primary-theme', colorVar: color, textColor: getReadableTextColor(color), buttonClass: 'member-primary-bg' };
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
        isFixo: Boolean(row.is_fixed),
        installmentGroupId: row.installment_group_id || null,
        installmentNumber: Number(row.installment_number || 1),
        installmentTotal: Number(row.installment_total || 1)
    };
}

function updateIdentityUI() {
    const activeMembers = getActiveMembers();
    applyMemberColors();
    document.title = `${appConfig.appName} | Pluri`;

    if (activeMembers.length === 1) {
        $('headerTitle').innerHTML = `<span class="member-primary-text">${escapeHtml(getDisplayMemberName(activeMembers[0].name)).toUpperCase()}</span>`;
    } else {
        $('headerTitle').innerHTML = `<span class="member-primary-text">${escapeHtml(getDisplayMemberName(activeMembers[0].name)).toUpperCase()}</span> & <span class="member-secondary-text">${escapeHtml(getDisplayMemberName(activeMembers[1].name)).toUpperCase()}</span>`;
    }

    const text = translations[currentLanguage] || translations['pt-BR'];
    $('totalLabel0').innerText = getDisplayMemberName(activeMembers[0]?.name || text.personOne);
    $('memberCard1').classList.toggle('hidden', activeMembers.length === 1);
    if (activeMembers[1]) $('totalLabel1').innerText = getDisplayMemberName(activeMembers[1].name);

    const badge = $('userBadge');
    if (currentSession?.user?.email) {
        badge.classList.remove('hidden');
        badge.innerText = currentSession.user.email;
    } else {
        badge.classList.add('hidden');
    }
    if ($('mobileMenuName')) $('mobileMenuName').innerText = appConfig.appName || 'Pluri';
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
                ${escapeHtml(getDisplayMemberName(member.name)).toUpperCase()}
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
    if (!$('syncButton') || !$('syncDescription')) return;
    const usingSupabase = Boolean(supabaseClient);
    const text = translations[currentLanguage] || translations['pt-BR'];
    $('syncButton').innerHTML = usingSupabase
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> <span id="syncButtonText">${text.syncButton}</span>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> <span id="syncButtonText">${text.syncButton}</span>`;
    $('syncDescription').innerText = usingSupabase
        ? 'Recarrega gastos, cartões e meta direto do Supabase.'
        : 'Baixa todos os gastos salvos na planilha';
}

function animateAuthPanel(nextVisibleId) {
    const authForm = $('authForm');
    const recoveryForm = $('recoveryForm');
    const panels = [authForm, recoveryForm].filter(Boolean);
    const nextPanel = $(nextVisibleId);
    const currentPanel = panels.find((panel) => !panel.classList.contains('hidden'));

    if (!nextPanel || currentPanel === nextPanel) return;

    if (currentPanel) currentPanel.classList.add('is-leaving');
    nextPanel.classList.remove('hidden');
    nextPanel.classList.add('is-entering');

    window.setTimeout(() => {
        if (currentPanel) {
            currentPanel.classList.add('hidden');
            currentPanel.classList.remove('is-leaving');
        }

        nextPanel.classList.remove('is-entering');
    }, 180);
}

function switchAuthMode(mode) {
    authMode = mode;
    currentRecoveryMode = false;
    $('authName').classList.toggle('hidden', mode !== 'signup');
    $('authIncome').classList.toggle('hidden', mode !== 'signup');
    $('authPasswordConfirm').classList.toggle('hidden', mode !== 'signup');
    $('authPassword').classList.toggle('hidden', mode === 'reset');
    $('authPassword').required = mode !== 'reset';
    $('authPasswordConfirm').required = mode === 'signup';
    $('authIncome').required = mode === 'signup';
    $('googleAuthButton')?.classList.toggle('hidden', mode === 'reset');
    animateAuthPanel('authForm');

    const tabs = {
        login: $('tabLogin'),
        signup: $('tabSignup'),
        reset: $('tabReset')
    };

    Object.entries(tabs).forEach(([key, element]) => {
        element.classList.toggle('active', key === mode);
        element.classList.toggle('text-slate-400', key !== mode);
    });

    const text = translations[currentLanguage] || translations['pt-BR'];
    const authCopy = getAuthModeCopy(text);
    if ($('authKicker')) $('authKicker').innerText = authCopy.kicker || '';
    if ($('authTitle')) $('authTitle').innerText = authCopy.title || '';
    if ($('authSubtitle')) $('authSubtitle').innerText = authCopy.subtitle || '';
    $('authSubmitBtn').innerText = mode === 'signup' ? text.createAccount : mode === 'reset' ? text.sendLink : text.login;
    $('authMessage').innerText = '';
}

function showRecoveryForm() {
    currentRecoveryMode = true;
    $('authOverlay').classList.remove('hidden');
    animateAuthPanel('recoveryForm');
    $('authMessage').innerText = 'Defina sua nova senha.';
}

function setAuthButtonLoading(button, isLoading, label = '') {
    if (!button) return;
    button.disabled = isLoading;
    button.classList.toggle('opacity-70', isLoading);
    button.classList.toggle('cursor-not-allowed', isLoading);
    if (isLoading) {
        button.innerHTML = `<span class="button-spinner"></span><span>${escapeHtml(label)}</span>`;
    }
}

async function signInWithGoogle() {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: APP_URL
        }
    });
    if (error) $('authMessage').innerText = error.message;
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    if (!supabaseClient) return;

    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const fullName = $('authName').value.trim();
    const monthlyIncome = parseFloat($('authIncome')?.value || '0') || null;
    const submitButton = $('authSubmitBtn');
    const originalText = submitButton.innerText;
    const loadingLabel = authMode === 'login'
        ? 'Entrando...'
        : authMode === 'signup'
            ? 'Criando...'
            : 'Enviando...';

    setAuthButtonLoading(submitButton, true, loadingLabel);
    $('authMessage').innerText = '';

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
                    emailRedirectTo: APP_URL,
                    data: { full_name: fullName, monthly_income: monthlyIncome }
                }
            });

            $('authMessage').innerText = error ? error.message : 'Conta criada. Verifique seu email para confirmar o acesso.';
            return;
        }

        if (authMode === 'reset') {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
            $('authMessage').innerText = error ? error.message : 'Enviamos o link de redefinicao para seu email.';
            return;
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            $('authMessage').innerText = error.message;
            return;
        }

        if (data?.session) {
            window.setTimeout(() => {
                handleAuthState(data.session).catch((stateError) => {
                    console.error(stateError);
                    $('authMessage').innerText = stateError.message || 'Erro ao abrir sua conta.';
                });
            }, 0);
        }
    } finally {
        setAuthButtonLoading(submitButton, false);
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
    closeModal('modalLogout');
    await supabaseClient.auth.signOut();
}

function requestLogout() {
    closeAppOverlays('modalLogout');
    setMobileNavActive('logout');
    const text = translations[currentLanguage] || translations['pt-BR'];
    if ($('logoutModalTitle')) $('logoutModalTitle').innerText = text.logoutTitle;
    if ($('logoutModalText')) $('logoutModalText').innerText = text.logoutConfirm;
    if ($('logoutModalCancel')) $('logoutModalCancel').innerText = text.logoutCancel;
    if ($('logoutModalConfirm')) $('logoutModalConfirm').innerText = text.logoutConfirmAction;
    openModal('modalLogout');
}

function requestDeleteAccount() {
    closeAppOverlays('modalDeleteAccount');
    const text = translations[currentLanguage] || translations['pt-BR'];
    if ($('deleteAccountModalTitle')) $('deleteAccountModalTitle').innerText = text.deleteAccountTitle;
    if ($('deleteAccountModalText')) $('deleteAccountModalText').innerText = text.deleteAccountText;
    if ($('deleteAccountModalCancel')) $('deleteAccountModalCancel').innerText = text.deleteAccountCancel;
    if ($('deleteAccountModalConfirm')) $('deleteAccountModalConfirm').innerText = text.deleteAccountConfirm;
    openModal('modalDeleteAccount');
}

async function deleteAccount() {
    if (!supabaseClient || !currentSession) return;
    const text = translations[currentLanguage] || translations['pt-BR'];
    const button = $('deleteAccountModalConfirm');
    if (button) {
        button.disabled = true;
        button.innerText = text.saving;
    }

    const { error } = await supabaseClient.rpc('delete_my_account');
    if (error) {
        if (String(error.message || '').includes('delete_my_account')) {
            showToast(text.deleteAccountMissingRpc);
        } else {
            showToast(error.message);
        }
        if (button) {
            button.disabled = false;
            button.innerText = text.deleteAccountConfirm;
        }
        return;
    }

    closeModal('modalDeleteAccount');
    await supabaseClient.auth.signOut();
}

async function handleProfileSubmit(event) {
    event.preventDefault();
    if (!supabaseClient || !currentSession) return;

    const fullName = $('profileFullName').value.trim();
    const monthlyIncome = parseFloat($('profileMonthlyIncome')?.value || 0) || null;
    const message = $('profileMessage');
    const text = translations[currentLanguage] || translations['pt-BR'];
    message.innerText = text.saving;

    const { data, error } = await supabaseClient
        .from('profiles')
        .update({ full_name: fullName || null, monthly_income: monthlyIncome })
        .eq('id', currentSession.user.id)
        .select()
        .maybeSingle();

    if (error) {
        message.innerText = error.message;
        return;
    }

    currentProfile = data || currentProfile;
    updateProfilePage();
    message.innerText = text.profileUpdated;
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
            { name: currentMembers[0]?.display_name || 'Pessoa 1', theme: 'primary', color: currentMembers[0]?.custom_color || '' },
            { name: currentMembers[1]?.display_name || 'Pessoa 2', theme: 'secondary', color: currentMembers[1]?.custom_color || '' }
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
    $('onboardingIncome').value = currentProfile?.monthly_income || '';
    setOnboardingHouseholdType('couple');
    $('onboardingMessage').innerText = '';
}

async function handleOnboardingSubmit(event) {
    event.preventDefault();
    if (!supabaseClient || !currentSession) return;

    const appName = $('onboardingAppName').value.trim();
    const pessoa1 = $('onboardingPessoa1').value.trim();
    const pessoa2 = $('onboardingPessoa2').value.trim();
    const monthlyIncome = parseFloat($('onboardingIncome').value || '0') || null;

    if (!appName || !pessoa1 || !monthlyIncome || (onboardingHouseholdType === 'couple' && !pessoa2)) {
        $('onboardingMessage').innerText = 'Preencha os campos obrigatorios.';
        return;
    }

    $('onboardingMessage').innerText = 'Criando estrutura inicial...';

    const { data, error } = await supabaseClient.rpc('create_household_with_members', {
        p_name: appName,
        p_household_type: onboardingHouseholdType,
        p_primary_name: pessoa1,
        p_secondary_name: onboardingHouseholdType === 'couple' ? pessoa2 : null,
        p_monthly_income: monthlyIncome
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
    closeAppOverlays('modalConfig');
    setMobileNavActive('settings');
    if ($('profilePage')) $('profilePage').classList.add('hidden');
    if ($('dashboardPage')) $('dashboardPage').classList.remove('hidden');
    if (!currentHousehold) {
        showToast('A casa ainda nao foi carregada. Tente sincronizar e abrir novamente.');
        return;
    }

    $('editAppName').value = appConfig.appName;
    $('editPessoa1Nome').value = appConfig.members[0]?.name || '';
    $('editPessoa2Nome').value = appConfig.members[1]?.name || '';
    syncMemberColorInputs();
    $('metaAtiva').checked = meta.ativa;
    $('editMetaNome').value = meta.nome;
    $('editMetaAlvo').value = meta.alvo;
    $('editMetaAtual').value = meta.atual;
    if ($('languageSelect')) $('languageSelect').value = currentLanguage;
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
    const text = translations[currentLanguage] || translations['pt-BR'];
    textDisplay.innerText = cartaoSelecionado || text.selectCard;
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
    $('customSelectCartao')?.classList.toggle('select-open', shouldShow);
    $('seletorCartao')?.classList.toggle('select-open', shouldShow);
}

function toggleFiltroDropdown(show) {
    const shouldShow = show === undefined ? $('filtroDropdown').classList.contains('hidden') : show;
    $('filtroDropdown').classList.toggle('hidden', !shouldShow);
    $('filtroArrow').classList.toggle('rotate-180', shouldShow);
    $('customSelectFiltro')?.classList.toggle('select-open', shouldShow);
}

function setMetodo(metodo) {
    metodoPagamento = metodo;
    document.querySelectorAll('.chip-metodo').forEach((button) => button.classList.remove('active-chip'));
    const targetButton = Array.from(document.querySelectorAll('.chip-metodo')).find((button) => normalizeMetodo(button.textContent).includes(normalizeMetodo(metodo)));
    if (targetButton) targetButton.classList.add('active-chip');
    $('seletorCartao').classList.toggle('hidden', !isCartaoMetodo(metodo));
}

function toggleInstallments() {
    const checked = $('isParcelado')?.checked;
    $('installmentFields')?.classList.toggle('hidden', !checked);
    if (checked && $('installmentsCount') && Number($('installmentsCount').value || 0) < 2) {
        $('installmentsCount').value = 2;
    }
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
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${cat.svg}</svg><span class="text-[7px] font-bold uppercase mt-1">${getCategoryLabel(cat.id)}</span>`;
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
    const text = translations[currentLanguage] || translations['pt-BR'];
    btnSubmit.disabled = true;
    btnSubmit.innerText = text.saving;

    const occurredOn = $('dataGasto').value;
    const member = currentMembers.find((item) => item.display_name === pagadorAtual);
    const card = currentCards.find((item) => item.name === $('tipoCartao').value);
    const isInstallment = Boolean($('isParcelado')?.checked);
    const installmentTotal = isInstallment ? parseInt($('installmentsCount')?.value || '0', 10) : 1;
    if (isInstallment && (!installmentTotal || installmentTotal < 2)) {
        showToast(text.installmentInvalid);
        btnSubmit.disabled = false;
        btnSubmit.innerText = textoOriginal;
        return;
    }

    const installmentGroupId = isInstallment ? createGroupId() : null;
    const baseExpense = {
        household_id: currentHousehold.id,
        member_id: member?.id,
        card_id: isCartaoMetodo(metodoPagamento) ? card?.id || null : null,
        amount: parseFloat($('valor').value),
        category: categoriaSelecionada,
        description: $('descricao').value.trim() || categoriaSelecionada,
        payment_method: getPaymentMethodForDb(),
        is_fixed: $('isFixo').checked,
        created_by: currentSession.user.id
    };
    const expensesToInsert = Array.from({ length: installmentTotal }, (_, index) => ({
        ...baseExpense,
        occurred_on: addMonthsToDate(occurredOn, index),
        installment_group_id: installmentGroupId,
        installment_number: index + 1,
        installment_total: installmentTotal
    }));

    let insertResult = await supabaseClient
        .from('expenses')
        .insert(expensesToInsert)
        .select();

    if (insertResult.error && String(insertResult.error.message || '').includes('installment_')) {
        const fallbackExpenses = expensesToInsert.map(({ installment_group_id, installment_number, installment_total, ...expense }) => expense);
        showToast('Campos de parcelamento ainda nao existem no Supabase. Salvando sem marcadores de parcela.');
        insertResult = await supabaseClient
            .from('expenses')
            .insert(fallbackExpenses)
            .select();
    }

    const { data, error } = insertResult;

    btnSubmit.disabled = false;
    btnSubmit.innerText = textoOriginal;

    if (error) {
        showToast(error.message);
        return;
    }

    if (isCartaoMetodo(metodoPagamento) && card?.name) await salvarCartaoFavorito(pagadorAtual, card.name);

    gastos.unshift(...(data || []).map(makeUiExpense));
    gastos.sort((a, b) => new Date(b.dataRaw) - new Date(a.dataRaw));
    render();
    event.target.reset();
    $('dataGasto').valueAsDate = new Date();
    toggleInstallments();
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
    const saveButton = $('settingsSaveBtn');
    const text = translations[currentLanguage] || translations['pt-BR'];

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
        const primaryColor = normalizeHexColor($('editPessoa1Cor').value);
        const secondaryColor = normalizeHexColor($('editPessoa2Cor').value);
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
            const updatePrimary = await persistMemberConfig(primaryMember, {
                display_name: primaryName,
                custom_color: primaryColor || null,
                is_active: true,
                sort_order: 0
            });
            if (updatePrimary.error) {
                showToast(updatePrimary.error.message);
                return;
            }
        }

        if (householdType === 'couple') {
            if (secondaryMember) {
                const updateSecondary = await persistMemberConfig(secondaryMember, {
                    display_name: secondaryName,
                    custom_color: secondaryColor || null,
                    is_active: true,
                    sort_order: 1
                });
                if (updateSecondary.error) {
                    showToast(updateSecondary.error.message);
                    return;
                }
            } else {
                const insertSecondary = await insertMemberConfig({
                    household_id: currentHousehold.id,
                    display_name: secondaryName,
                    role: 'member',
                    color_key: 'secondary',
                    custom_color: secondaryColor || null,
                    sort_order: 1,
                    is_active: true
                });
                if (insertSecondary.error) {
                    showToast(insertSecondary.error.message);
                    return;
                }
            }
        } else if (secondaryMember) {
            const disableSecondary = await persistMemberConfig(secondaryMember, {
                display_name: secondaryName,
                custom_color: secondaryColor || null,
                is_active: false
            });
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
            saveButton.innerText = text.saveAll;
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
            $(`btnEdit${name}`)?.parentElement?.classList.remove('select-open');
        }
    });

    if (shouldShow && button) {
        dropdown.style.removeProperty('left');
        dropdown.style.removeProperty('top');
    }

    dropdown.classList.toggle('hidden', !shouldShow);
    arrow.classList.toggle('rotate-180', shouldShow);
    button?.parentElement?.classList.toggle('select-open', shouldShow);
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
        const originalPagador = gasto.pagador;
        if (totals[originalPagador] !== undefined) totals[originalPagador] += gasto.valor;
        const isPrimary = getMemberTheme(originalPagador) === 'primary';
        const text = translations[currentLanguage] || translations['pt-BR'];
        gasto = {
            ...gasto,
            pagador: getDisplayMemberName(originalPagador),
            dataDisplay: formatExpenseDate(gasto.dataRaw)
        };
        const installmentBadge = gasto.installmentTotal > 1
            ? `<span class="installment-badge">${gasto.installmentNumber}/${gasto.installmentTotal}</span>`
            : '';

        lista.innerHTML += `
            <div class="expense-card p-3 lg:p-4 ${isPrimary ? 'border-[var(--member-primary)]' : 'border-[var(--member-secondary-color)]'}">
                <div class="hidden lg:flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <span class="w-2 h-2 rounded-full ${isPrimary ? 'bg-[var(--member-primary)]' : 'bg-[var(--member-secondary-color)]'}"></span>
                        <div>
                            <p class="font-bold text-xs expense-title">${escapeHtml(gasto.descricao)}</p>
                            <p class="text-[8px] font-bold uppercase tracking-wider expense-meta">${escapeHtml(gasto.pagador)} • ${escapeHtml(gasto.metodo)} • ${escapeHtml(gasto.dataDisplay)} ${installmentBadge}</p>
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
                            <span class="w-2 h-2 rounded-full ${isPrimary ? 'bg-[var(--member-primary)]' : 'bg-[var(--member-secondary-color)]'}"></span>
                            <span class="text-xs font-bold uppercase expense-secondary">${escapeHtml(gasto.pagador)}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button onclick='openEditModal(${quoteJs(gasto.id)})' class="ghost-icon-button hover:text-[var(--primary-strong)] active:scale-95 transition-all" title="Editar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button onclick='confirmDelete(${quoteJs(gasto.id)})' class="ghost-icon-button hover:text-red-400 active:scale-95 transition-all text-lg" title="Excluir">x</button>
                        </div>
                    </div>
                    <p class="font-bold text-base expense-title mb-3">${escapeHtml(gasto.descricao)}</p>
                    <div class="flex justify-between items-center">
                        <p class="text-xs font-medium expense-meta">${escapeHtml(gasto.metodo)} • ${escapeHtml(gasto.dataDisplay)} ${installmentBadge}</p>
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
    updateMonthlySummaryNotice();
    if ($('profilePage') && !$('profilePage').classList.contains('hidden')) updateProfilePage();
}

function updateChart(values) {
    const ctx = $('chartDivisao').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: values.length === 1 ? [values[0] || 1] : values.map((value) => value || 1),
                backgroundColor: values.length === 1 ? ['#0f766e'] : ['#0f766e', '#1d4ed8'],
                borderWidth: 0
            }]
        },
        options: {
            cutout: '75%',
            plugins: { tooltip: { enabled: false } }
        }
    });
}

function getExportedExpenses() {
    const filtro = $('filtroMes').value;
    return filtro === 'all' ? gastos : gastos.filter((item) => item.mes === filtro);
}

function getExportFileBaseName() {
    const filtro = $('filtroMes')?.value || 'all';
    const date = new Date().toISOString().slice(0, 10);
    const appName = String(appConfig.appName || 'pluri')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'pluri';
    return `relatorio-${appName}-${filtro}-${date}`;
}

function getExportRows() {
    return getExportedExpenses().map((gasto) => ({
        data: gasto.dataRaw || gasto.dataDisplay,
        pagador: getDisplayMemberName(gasto.pagador),
        categoria: getCategoryLabel(gasto.categoria),
        metodo: String(gasto.metodo || '').trim(),
        descricao: gasto.descricao || '',
        valor: gasto.valor
    }));
}

function formatMoneyForExport(value) {
    return Number(value || 0).toLocaleString(getCurrentLocale(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function downloadExport(content, extension, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${getExportFileBaseName()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function getExportHeaders() {
    const text = translations[currentLanguage] || translations['pt-BR'];
    return [
        text.exportHeaderDate,
        text.exportHeaderPayer,
        text.exportHeaderCategory,
        text.exportHeaderMethod,
        text.exportHeaderDescription,
        text.exportHeaderAmount
    ];
}

function buildTxtExport(rows) {
    const text = translations[currentLanguage] || translations['pt-BR'];
    let txt = `${text.exportReportHeading} ${appConfig.appName.toUpperCase()}\n===============================\n`;
    rows.forEach((gasto) => {
        txt += `${gasto.data} | ${gasto.pagador} | ${gasto.categoria} | ${gasto.metodo} | ${gasto.descricao}: R$ ${formatMoneyForExport(gasto.valor)}\n`;
    });
    return txt;
}

function buildCsvExport(rows) {
    const header = getExportHeaders();
    const lines = rows.map((gasto) => [
        gasto.data,
        gasto.pagador,
        gasto.categoria,
        gasto.metodo,
        gasto.descricao,
        formatMoneyForExport(gasto.valor)
    ].map(csvCell).join(';'));
    return [header.map(csvCell).join(';'), ...lines].join('\n');
}

function buildXlsExport(rows) {
    const header = getExportHeaders();
    const tableRows = rows.map((gasto) => `
        <tr>
            <td>${escapeHtml(gasto.data)}</td>
            <td>${escapeHtml(gasto.pagador)}</td>
            <td>${escapeHtml(gasto.categoria)}</td>
            <td>${escapeHtml(gasto.metodo)}</td>
            <td>${escapeHtml(gasto.descricao)}</td>
            <td>${escapeHtml(formatMoneyForExport(gasto.valor))}</td>
        </tr>
    `).join('');
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><table><thead><tr>${header.map((item) => `<th>${item}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
}

function exportarRelatorio() {
    closeAppOverlays('modalExport');
    setMobileNavActive('export');
    openModal('modalExport');
}

function exportReportAs(format) {
    const text = translations[currentLanguage] || translations['pt-BR'];
    const rows = getExportRows();
    if (!rows.length) {
        showToast(text.exportEmpty);
        return;
    }

    closeModal('modalExport');

    if (format === 'csv') {
        downloadExport(buildCsvExport(rows), 'csv', 'text/csv;charset=utf-8');
        return;
    }

    if (format === 'xls') {
        downloadExport(buildXlsExport(rows), 'xls', 'application/vnd.ms-excel;charset=utf-8');
        return;
    }

    const txt = buildTxtExport(rows);
    if (format === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank', 'noopener,noreferrer');
        return;
    }

    downloadExport(txt, 'txt', 'text/plain;charset=utf-8');
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
        const appMenu = $('appMenu');
        if (appMenu && !appMenu.contains(event.target)) toggleAppMenu(false);
        const languageSelect = $('languageSelectWrap');
        if (languageSelect && !languageSelect.contains(event.target)) toggleLanguageDropdown(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            toggleAppMenu(false);
            toggleLanguageDropdown(false);
        }
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
    if ($('profileForm')) $('profileForm').addEventListener('submit', handleProfileSubmit);
}

async function bootstrap() {
    try {
        bindUiEvents();
        applyTheme(loadThemePreference());
        setLanguage(currentLanguage);
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

