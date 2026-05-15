const categories = [
    { id: 'Comida', svg: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>' },
    { id: 'Lazer', svg: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="15" cy="13" r="1"/>' },
    { id: 'Mercado', svg: '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' },
    { id: 'Viagem', svg: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>' },
    { id: 'Outros', svg: '<circle cx="12" cy="12" r="3"/><path d="M3 12h3m12 0h3M12 3v3m0 12v3"/>' }
];

const APP_URL = 'https://pluri.netlify.app';

const monthLabels = {
    'pt-BR': ['Todos os meses', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    'en-US': ['All Months', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    'es-ES': ['Todos los meses', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
};

const categoryLabels = {
    'pt-BR': { Comida: 'Comida', Lazer: 'Lazer', Mercado: 'Mercado', Viagem: 'Viagem', Outros: 'Outros' },
    'en-US': { Comida: 'Food', Lazer: 'Fun', Mercado: 'Groceries', Viagem: 'Travel', Outros: 'Other' },
    'es-ES': { Comida: 'Comida', Lazer: 'Ocio', Mercado: 'Mercado', Viagem: 'Viaje', Outros: 'Otros' }
};

const languageNames = {
    'pt-BR': { 'pt-BR': 'Português', 'en-US': 'Inglês', 'es-ES': 'Espanhol' },
    'en-US': { 'pt-BR': 'Portuguese', 'en-US': 'English', 'es-ES': 'Spanish' },
    'es-ES': { 'pt-BR': 'Portugués', 'en-US': 'Inglés', 'es-ES': 'Español' }
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
let categoryBudgets = {};
let cartaoFavorito = {};
let appConfig = { ...defaultAppConfig };
let householdTypeDraft = appConfig.householdType;
let pagadorAtual = appConfig.members[0].name;
let categoriaSelecionada = 'Comida';
let metodoPagamento = 'PIX';
let cartaoSelecionado = '';
let chart = null;
let monthlyCategoryChart = null;
let monthlyDailyChart = null;
let monthlyDashboardPeriod = '';
let deleteIdTemp = null;
let deleteContextTemp = 'single';
let deleteInstallmentTemp = null;
let editingCardId = null;
let deleteCardIdTemp = null;

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
                subtitle: 'Sua área financeira segura e sincronizada.'
            },
            signup: {
                kicker: 'Comece seu controle',
                title: 'Criar conta no Pluri',
                subtitle: 'Monte seu espaço financeiro em poucos segundos.'
            },
            reset: {
                kicker: 'Recupere o acesso',
                title: 'Esqueci minha senha',
                subtitle: 'Informe seu e-mail para receber o link de recuperação.'
            }
        },
        heroKicker: 'Controle financeiro',
        heroSubtitle: 'Acompanhe gastos, cartões e metas em uma área financeira organizada para casa, casal ou uso individual.',
        heroBulletHomesTitle: 'Casas',
        heroBulletHomesText: 'Solo ou casal.',
        heroBulletCardsTitle: 'Cartões',
        heroBulletCardsText: 'Preferências por pessoa.',
        heroBulletGoalsTitle: 'Metas',
        heroBulletGoalsText: 'Evolução clara.',
        onboardingBadge: 'Onboarding',
        onboardingHeroTitle: 'Monte sua casa financeira do seu jeito.',
        onboardingHeroSubtitle: 'Defina o nome do espaço, escolha se o app é solo ou casal e personalize a estrutura inicial em menos de um minuto.',
        onboardingLightTitle: 'Tema leve',
        onboardingLightText: 'Visual claro elegante logo no primeiro acesso, com modo escuro disponível quando você quiser.',
        onboardingFlexibleTitle: 'Estrutura flexível',
        onboardingFlexibleText: 'Solo ou casal, sem elementos sobrando e sem ficar preso a um único formato.',
        onboardingKicker: 'Primeira configuração',
        onboardingTitle: 'Criar meu espaço',
        onboardingSubtitle: 'Essas escolhas definem a base do seu Pluri e podem ser alteradas depois em configurações.',
        onboardingAppNameLabel: 'Nome do app',
        onboardingStructureLabel: 'Estrutura',
        onboardingCouple: 'Casal',
        onboardingSolo: 'Solo',
        onboardingCardsLabel: 'Cartões iniciais',
        onboardingCardsPlaceholder: 'Ex: Nubank, Inter, C6',
        onboardingClosingDayLabel: 'Fechamento do mês',
        onboardingClosingDayPlaceholder: 'Dia do fechamento. Ex: 10',
        onboardingCategoriesLabel: 'Categorias mais usadas',
        onboardingGoalLabel: 'Objetivo financeiro',
        onboardingGoalPlaceholder: 'Ex: Guardar para viagem',
        onboardingGoalTargetPlaceholder: 'Meta opcional R$',
        onboardingCreate: 'Criar minha casa',
        onboardingRequired: 'Preencha os campos obrigatórios.',
        onboardingCreating: 'Criando estrutura inicial...',
        onboardingCreateError: 'Não foi possível criar a casa.',
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
        deleteAccountText: 'Essa ação remove sua conta e os dados vinculados a ela. Não dá para desfazer.',
        deleteAccountButton: 'Apagar conta',
        deleteAccountCancel: 'Cancelar',
        deleteAccountConfirm: 'Sim, apagar',
        deleteAccountMissingRpc: 'A função delete_my_account ainda não existe no Supabase. Rode o SQL de apagar conta.',
        fixed: 'Fixo',
        installment: 'Parcelado',
        installmentsLabel: 'Parcelas',
        installmentsPlaceholder: 'Ex: 6',
        installmentHint: 'O valor informado será repetido mensalmente por parcela.',
        installmentInvalid: 'Informe pelo menos 2 parcelas.',
        installmentsFilter: 'Parcelas',
        installmentOf: 'Parcela {current} de {total}',
        installmentGroupLabel: 'Grupo de parcelas',
        installmentGroupProgress: '{paid} de {total} parcelas registradas',
        editFutureInstallments: 'Aplicar nesta e nas próximas parcelas',
        cancelFutureInstallments: 'Cancelar parcelas futuras',
        cancelFutureInstallmentsTitle: 'Cancelar parcelas futuras?',
        futureInstallmentsCanceled: 'Parcelas futuras canceladas.',
        noInstallmentsFound: 'Nenhum parcelamento encontrado.',
        updatePassword: 'Atualizar senha',
        settingsKicker: 'Preferências',
        settingsTitle: 'Configurações',
        languageLabel: 'Idioma',
        appProfileLabel: 'Perfil do App',
        savingsGoalLabel: 'Meta de Economia',
        categoryBudgetsLabel: 'Orçamentos por categoria',
        categoryBudgetsHint: 'Defina limites mensais. Deixe 0 para não acompanhar a categoria.',
        monthlyDashboardTitle: 'Painel do mês',
        monthlyDashboardSubtitle: 'Acompanhe seus limites por categoria e veja onde o dinheiro está indo.',
        monthlyDashboardNav: 'Painel',
        cardsNav: 'Cartões',
        cardsPageKicker: 'Cartões',
        cardsPageTitle: 'Meus cartões',
        cardsPageSubtitle: 'Veja gastos por cartão, fatura do mês e próximas parcelas em um só lugar.',
        cardsRegisteredLabel: 'Cartões ativos',
        cardsTotalSpentLabel: 'Gasto em cartões',
        cardAddTitle: 'Adicionar cartão',
        cardNameLabel: 'Nome do cartão',
        cardNamePlaceholder: 'Ex: Nubank PJ',
        cardLimitPlaceholder: 'Limite opcional R$',
        cardClosingPlaceholder: 'Fechamento',
        cardDuePlaceholder: 'Vencimento',
        cardAddButton: 'Adicionar cartão',
        cardManageLabel: 'Editar dados',
        cardSaveButton: 'Salvar cartão',
        cardCancelButton: 'Cancelar',
        cardRemoveButton: 'Remover',
        cardDeleteTitle: 'Remover cartão?',
        cardDeleteText: 'Os gastos antigos continuam salvos, mas o cartão sai da sua lista ativa.',
        cardSaved: 'Cartão salvo.',
        cardRemoved: 'Cartão removido.',
        cardBillingFieldsMissing: 'Rode a migration de campos de cartão no Supabase para salvar limite, fechamento e vencimento.',
        cardInvoiceLabel: 'Fatura do mês',
        cardLimitLabel: 'Limite',
        cardClosingLabel: 'Fechamento',
        cardNextInstallmentsLabel: 'Próximas parcelas',
        cardExpensesLabel: 'Gastos do cartão',
        cardNoCards: 'Cadastre um cartão nas configurações para acompanhar faturas e parcelas.',
        cardNoExpenses: 'Nenhum gasto nesse cartão ainda.',
        cardNoInstallments: 'Sem próximas parcelas.',
        cardLimitNotSet: 'Sem limite',
        cardClosingNotSet: 'Não definido',
        monthlyDashboardKicker: 'Resumo inteligente',
        monthlyTotalLabel: 'Gasto no mês',
        monthlyPreviousLabel: 'Mês anterior',
        monthlyDailyLabel: 'Evolução diária',
        monthlyCategoryLabel: 'Distribuição por categoria',
        monthlyBudgetHealthLabel: 'Saúde dos orçamentos',
        monthlyPeriodLabel: 'Período',
        monthlyTopDayLabel: 'Dia mais caro',
        monthlyNoData: 'Sem dados para este mês ainda.',
        monthlyChangeUp: 'acima do mês anterior',
        monthlyChangeDown: 'abaixo do mês anterior',
        monthlyChangeFlat: 'igual ao mês anterior',
        monthlyAdjustLimits: 'Ajustar limites',
        monthlyInsightsLabel: 'Leitura do mês',
        monthlyInsightsTitle: 'O que merece sua atenção',
        monthlyInsightEmpty: 'Assim que você registrar alguns lançamentos, o Pluri mostra alertas e oportunidades aqui.',
        monthlyInsightBudgetExceededTitle: 'Limite estourado',
        monthlyInsightBudgetExceededText: 'passou do limite em',
        monthlyInsightBudgetWarningTitle: 'Quase no limite',
        monthlyInsightWarningText: 'já consumiu',
        monthlyInsightTopCategoryTitle: 'Categoria dominante',
        monthlyInsightTopCategoryText: 'concentra',
        monthlyInsightTopCategorySuffix: 'dos gastos do mês.',
        monthlyInsightMonthUpTitle: 'Mês mais pesado',
        monthlyInsightMonthDownTitle: 'Mês mais leve',
        monthlyInsightMonthChangeText: 'em relação ao mês anterior.',
        monthlyInsightBigDayTitle: 'Pico de gastos',
        monthlyInsightBigDayText: 'foi o dia com maior saída.',
        monthlyInsightNoBudgetTitle: 'Defina seus limites',
        monthlyInsightNoBudgetText: 'Adicionar limites por categoria deixa o painel mais útil e ajuda a evitar surpresas.',
        monthlyInsightStableTitle: 'Tudo sob controle',
        monthlyInsightStableText: 'Nenhum alerta importante apareceu neste mês. Continue acompanhando para manter o ritmo.',
        budgetAlertExceeded: 'ultrapassou o orçamento do mês',
        budgetAlertWarning: 'já consumiu',
        budgetAlertOfLimit: 'do limite',
        notificationsKicker: 'Notificações',
        notificationsTitle: 'Atenção financeira',
        notificationsEmpty: 'Sem alertas importantes agora.',
        notificationMonthClosing: 'O mês está perto de fechar. Revise seus gastos e veja o painel mensal.',
        notificationGoalWarning: 'Sua meta está perto do limite planejado.',
        notificationInvoiceSoon: 'Fatura chegando',
        notificationSummaryReady: 'Seu resumo financeiro já pode ser conferido.',
        budgetUsed: 'usado',
        budgetNoLimit: 'Sem limite definido',
        budgetSafe: 'Dentro do limite',
        budgetWarning: 'Perto do limite',
        budgetExceeded: 'Limite ultrapassado',
        activateGoal: 'Ativar Meta',
        myCardsLabel: 'Meus cartões',
        syncLabel: 'Sincronização',
        syncButton: 'Sincronizar com Planilha',
        close: 'Fechar',
        saveAll: 'Salvar tudo',
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
        historyKicker: 'Histórico',
        historyTitle: 'Seus lançamentos',
        historySubtitle: 'Navegue pelos registros com uma leitura mais limpa, rápida e confortável.',
        newExpenseKicker: 'Novo gasto',
        newExpenseTitle: 'Adicionar lançamento',
        newExpenseSubtitle: 'Entrada rápida, categorias visuais e seleção de pagador sem atrito.',
        registerExpense: 'Registrar gasto',
        descriptionPlaceholder: 'Descrição...',
        cardMethod: 'Cartão',
        selectCard: 'Selecionar cartão',
        noExpenses: 'Seus lançamentos vão aparecer aqui.',
        metaOff: 'Meta Off',
        saving: 'Salvando...',
        personOne: 'Pessoa 1',
        personTwo: 'Pessoa 2',
        edit: 'Editar',
        delete: 'Excluir',
        appHeaderKicker: 'Painel Pluri',
        appHeaderSubtitle: 'Seus gastos em um espaço mais claro, leve e agradável de acompanhar.',
        home: 'Início',
        profile: 'Perfil',
        profileKicker: 'Conta',
        profileTitle: 'Meu perfil',
        profileSubtitle: 'Gerencie seus dados, renda e preferências principais do Pluri.',
        profilePersonalData: 'Dados pessoais',
        profileSummary: 'Resumo da conta',
        profileEmail: 'Email',
        profileHousehold: 'Casa',
        profileIncome: 'Renda mensal',
        profileEntries: 'Lançamentos',
        profileCards: 'Cartões',
        profileMembers: 'Pessoas',
        profileBack: 'Voltar ao painel',
        profileNameLabel: 'Nome',
        profileIncomeLabel: 'Renda mensal',
        profileSave: 'Salvar perfil',
        profileUpdated: 'Perfil atualizado.',
        summaryReadyTitle: 'Seu resumo financeiro está pronto',
        summaryReadyText: 'Veja como seus gastos fecharam este mês e onde você pode ajustar antes do próximo ciclo.',
        summaryOpen: 'Ver resumo',
        summaryTest: 'Testar resumo',
        summaryDismiss: 'Depois',
        summaryTitle: 'Resumo financeiro',
        summarySubtitle: 'Uma leitura rápida do seu mês atual.',
        summaryTotal: 'Total do mês',
        summaryAverage: 'Média por lançamento',
        summaryTopCategory: 'Maior categoria',
        summaryNoCategory: 'Sem categoria',
        summaryTransactions: 'Lançamentos',
        settings: 'Configurações',
        export: 'Exportar',
        logout: 'Sair',
        colorLabel: 'Cor',
        defaultColor: 'Padrão',
        useDefaultColor: 'Usar padrão',
        exportTitle: 'Exportar relatório',
        exportSubtitle: 'Escolha o formato ideal para baixar ou compartilhar seus lançamentos filtrados.',
        exportCsv: 'Planilha CSV',
        exportPdf: 'PDF visual',
        exportTxt: 'Texto TXT',
        exportXls: 'Excel XLS',
        exportWhatsapp: 'WhatsApp',
        exportEmpty: 'Não há lançamentos para exportar.',
        exportReportHeading: 'RELATÓRIO FINANCEIRO',
        exportHeaderDate: 'Data',
        exportHeaderPayer: 'Pagador',
        exportHeaderCategory: 'Categoria',
        exportHeaderMethod: 'Método',
        exportHeaderDescription: 'Descrição',
        exportHeaderAmount: 'Valor',
        accountLabel: 'Conta',
        soloModeHint: 'No modo solo, a segunda pessoa fica oculta da interface.',
        deleteRecordTitle: 'Excluir registro?',
        no: 'Não',
        yes: 'Sim',
        editExpenseTitle: 'Editar gasto',
        payerLabel: 'Pagador',
        categoryLabel: 'Categoria',
        methodLabel: 'Método',
        amountLabel: 'Valor (R$)',
        dateLabel: 'Data',
        updatedAvailable: 'Nova versão disponível',
        update: 'Atualizar',
        setupTitle: 'Configurar Supabase',
        setupText: 'Preencha `supabase-config.js` com a URL e a anon key do projeto `Pluri` para liberar login e onboarding.',
        setupHint: 'Assim que salvar o arquivo e recarregar a página, o app usa o novo projeto automaticamente.',
        defineNewPassword: 'Defina sua nova senha.',
        signingIn: 'Entrando...',
        loginSuccessTitle: 'Login feito com sucesso!',
        loginSuccessText: 'Tudo certo. Estamos preparando seu Pluri.',
        loadingDashboard: 'Carregando painel...',
        creating: 'Criando...',
        sending: 'Enviando...',
        passwordMismatch: 'As senhas não conferem.',
        accountCreated: 'Conta criada. Verifique seu e-mail para confirmar o acesso.',
        resetLinkSent: 'Enviamos o link de redefinição para seu e-mail.',
        accountOpenError: 'Erro ao abrir sua conta.',
        passwordUpdated: 'Senha atualizada com sucesso. Entrando no app...',
        expenseSaved: 'Gasto registrado!',
        expenseEdited: 'Gasto editado!',
        emptyExpensesTitle: 'Nada por aqui ainda',
        emptyExpensesText: 'Registre um lançamento para começar a enxergar seu histórico com clareza.',
        emptyInstallmentsTitle: 'Nenhuma parcela encontrada',
        emptyInstallmentsText: 'Quando você criar um gasto parcelado, o grupo de parcelas aparece aqui.',
        configSaved: 'Configurações salvas!',
        supabaseRequired: 'Configure o Supabase para salvar gastos.',
        sessionUpdateError: 'Erro ao atualizar a sessão.',
        sessionOpenError: 'Erro ao abrir a sessão.',
        appStartError: 'Erro ao iniciar o app',
        unknownError: 'desconhecido'
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
        heroKicker: 'Financial control',
        heroSubtitle: 'Track expenses, cards and goals in an organized financial space for home, couples or individual use.',
        heroBulletHomesTitle: 'Homes',
        heroBulletHomesText: 'Solo or couple.',
        heroBulletCardsTitle: 'Cards',
        heroBulletCardsText: 'Preferences per person.',
        heroBulletGoalsTitle: 'Goals',
        heroBulletGoalsText: 'Clear progress.',
        onboardingBadge: 'Onboarding',
        onboardingHeroTitle: 'Set up your financial home your way.',
        onboardingHeroSubtitle: 'Name your space, choose solo or couple mode and personalize the initial setup in under a minute.',
        onboardingLightTitle: 'Light theme',
        onboardingLightText: 'An elegant light look on first access, with dark mode available whenever you want.',
        onboardingFlexibleTitle: 'Flexible structure',
        onboardingFlexibleText: 'Solo or couple, without leftover elements and without being locked into one format.',
        onboardingKicker: 'First setup',
        onboardingTitle: 'Create my space',
        onboardingSubtitle: 'These choices define your Pluri foundation and can be changed later in settings.',
        onboardingAppNameLabel: 'App name',
        onboardingStructureLabel: 'Structure',
        onboardingCouple: 'Couple',
        onboardingSolo: 'Solo',
        onboardingCardsLabel: 'Initial cards',
        onboardingCardsPlaceholder: 'Ex: Nubank, Inter, C6',
        onboardingClosingDayLabel: 'Month closing day',
        onboardingClosingDayPlaceholder: 'Closing day. Ex: 10',
        onboardingCategoriesLabel: 'Most used categories',
        onboardingGoalLabel: 'Financial goal',
        onboardingGoalPlaceholder: 'Ex: Save for a trip',
        onboardingGoalTargetPlaceholder: 'Optional target $',
        onboardingCreate: 'Create my home',
        onboardingRequired: 'Fill in the required fields.',
        onboardingCreating: 'Creating initial structure...',
        onboardingCreateError: 'Could not create the home.',
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
        installmentsFilter: 'Installments',
        installmentOf: 'Installment {current} of {total}',
        installmentGroupLabel: 'Installment group',
        installmentGroupProgress: '{paid} of {total} installments registered',
        editFutureInstallments: 'Apply to this and upcoming installments',
        cancelFutureInstallments: 'Cancel future installments',
        cancelFutureInstallmentsTitle: 'Cancel future installments?',
        futureInstallmentsCanceled: 'Future installments canceled.',
        noInstallmentsFound: 'No installment plan found.',
        updatePassword: 'Update password',
        settingsKicker: 'Preferences',
        settingsTitle: 'Settings',
        languageLabel: 'Language',
        appProfileLabel: 'App profile',
        savingsGoalLabel: 'Savings goal',
        categoryBudgetsLabel: 'Category budgets',
        categoryBudgetsHint: 'Set monthly limits. Leave 0 to stop tracking a category.',
        monthlyDashboardTitle: 'Monthly dashboard',
        monthlyDashboardSubtitle: 'Track category limits and see where your money is going.',
        monthlyDashboardNav: 'Dashboard',
        cardsNav: 'Cards',
        cardsPageKicker: 'Cards',
        cardsPageTitle: 'My cards',
        cardsPageSubtitle: 'See spending by card, this month invoice and upcoming installments in one place.',
        cardsRegisteredLabel: 'Active cards',
        cardsTotalSpentLabel: 'Card spending',
        cardAddTitle: 'Add card',
        cardNameLabel: 'Card name',
        cardNamePlaceholder: 'Ex: Nubank PJ',
        cardLimitPlaceholder: 'Optional limit $',
        cardClosingPlaceholder: 'Closing',
        cardDuePlaceholder: 'Due date',
        cardAddButton: 'Add card',
        cardManageLabel: 'Edit data',
        cardSaveButton: 'Save card',
        cardCancelButton: 'Cancel',
        cardRemoveButton: 'Remove',
        cardDeleteTitle: 'Remove card?',
        cardDeleteText: 'Past expenses stay saved, but the card leaves your active list.',
        cardSaved: 'Card saved.',
        cardRemoved: 'Card removed.',
        cardBillingFieldsMissing: 'Run the card fields migration in Supabase to save limit, closing and due dates.',
        cardInvoiceLabel: 'Month invoice',
        cardLimitLabel: 'Limit',
        cardClosingLabel: 'Closing',
        cardNextInstallmentsLabel: 'Upcoming installments',
        cardExpensesLabel: 'Card expenses',
        cardNoCards: 'Add a card in settings to track invoices and installments.',
        cardNoExpenses: 'No expenses on this card yet.',
        cardNoInstallments: 'No upcoming installments.',
        cardLimitNotSet: 'No limit',
        cardClosingNotSet: 'Not set',
        monthlyDashboardKicker: 'Smart summary',
        monthlyTotalLabel: 'Month spending',
        monthlyPreviousLabel: 'Previous month',
        monthlyDailyLabel: 'Daily trend',
        monthlyCategoryLabel: 'Category distribution',
        monthlyBudgetHealthLabel: 'Budget health',
        monthlyPeriodLabel: 'Period',
        monthlyTopDayLabel: 'Most expensive day',
        monthlyNoData: 'No data for this month yet.',
        monthlyChangeUp: 'above previous month',
        monthlyChangeDown: 'below previous month',
        monthlyChangeFlat: 'same as previous month',
        monthlyAdjustLimits: 'Adjust limits',
        monthlyInsightsLabel: 'Monthly read',
        monthlyInsightsTitle: 'What deserves your attention',
        monthlyInsightEmpty: 'Once you add a few entries, Pluri will show alerts and opportunities here.',
        monthlyInsightBudgetExceededTitle: 'Limit exceeded',
        monthlyInsightBudgetExceededText: 'went over the limit in',
        monthlyInsightBudgetWarningTitle: 'Near the limit',
        monthlyInsightWarningText: 'has already used',
        monthlyInsightTopCategoryTitle: 'Dominant category',
        monthlyInsightTopCategoryText: 'represents',
        monthlyInsightTopCategorySuffix: 'of this month spending.',
        monthlyInsightMonthUpTitle: 'Heavier month',
        monthlyInsightMonthDownTitle: 'Lighter month',
        monthlyInsightMonthChangeText: 'compared with the previous month.',
        monthlyInsightBigDayTitle: 'Spending peak',
        monthlyInsightBigDayText: 'was the day with the highest outflow.',
        monthlyInsightNoBudgetTitle: 'Set your limits',
        monthlyInsightNoBudgetText: 'Adding category limits makes the dashboard more useful and helps avoid surprises.',
        monthlyInsightStableTitle: 'Everything under control',
        monthlyInsightStableText: 'No major alerts showed up this month. Keep tracking to maintain the pace.',
        budgetAlertExceeded: 'went over this month budget',
        budgetAlertWarning: 'has already used',
        budgetAlertOfLimit: 'of the limit',
        notificationsKicker: 'Notifications',
        notificationsTitle: 'Financial attention',
        notificationsEmpty: 'No important alerts right now.',
        notificationMonthClosing: 'The month is close to closing. Review spending and check the monthly dashboard.',
        notificationGoalWarning: 'Your goal is getting close to the planned limit.',
        notificationInvoiceSoon: 'Invoice coming',
        notificationSummaryReady: 'Your financial summary is ready to review.',
        budgetUsed: 'used',
        budgetNoLimit: 'No limit set',
        budgetSafe: 'Within limit',
        budgetWarning: 'Near limit',
        budgetExceeded: 'Limit exceeded',
        activateGoal: 'Activate goal',
        myCardsLabel: 'My cards',
        syncLabel: 'Sync',
        syncButton: 'Sync with Cloud',
        close: 'Close',
        saveAll: 'Save all',
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
        registerExpense: 'Register expense',
        descriptionPlaceholder: 'Description...',
        cardMethod: 'Card',
        selectCard: 'Select card',
        noExpenses: 'Your entries will appear here.',
        metaOff: 'Goal off',
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
        exportPdf: 'Visual PDF',
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
        exportHeaderAmount: 'Amount',
        accountLabel: 'Account',
        soloModeHint: 'In solo mode, the second person is hidden from the interface.',
        deleteRecordTitle: 'Delete entry?',
        no: 'No',
        yes: 'Yes',
        editExpenseTitle: 'Edit expense',
        payerLabel: 'Payer',
        categoryLabel: 'Category',
        methodLabel: 'Method',
        amountLabel: 'Amount ($)',
        dateLabel: 'Date',
        updatedAvailable: 'New version available',
        update: 'Update',
        setupTitle: 'Configure Supabase',
        setupText: 'Fill `supabase-config.js` with the URL and anon key from the `Pluri` project to enable login and onboarding.',
        setupHint: 'After saving the file and reloading the page, the app automatically uses the new project.',
        defineNewPassword: 'Set your new password.',
        signingIn: 'Signing in...',
        loginSuccessTitle: 'Signed in successfully!',
        loginSuccessText: 'All set. We are preparing your Pluri.',
        loadingDashboard: 'Loading dashboard...',
        creating: 'Creating...',
        sending: 'Sending...',
        passwordMismatch: 'Passwords do not match.',
        accountCreated: 'Account created. Check your email to confirm access.',
        resetLinkSent: 'We sent the reset link to your email.',
        accountOpenError: 'Error opening your account.',
        passwordUpdated: 'Password updated successfully. Opening the app...',
        expenseSaved: 'Expense registered!',
        expenseEdited: 'Expense updated!',
        emptyExpensesTitle: 'Nothing here yet',
        emptyExpensesText: 'Add an entry to start seeing your history clearly.',
        emptyInstallmentsTitle: 'No installments found',
        emptyInstallmentsText: 'When you create an installment expense, the installment group appears here.',
        configSaved: 'Settings saved!',
        supabaseRequired: 'Configure Supabase to save expenses.',
        sessionUpdateError: 'Error updating the session.',
        sessionOpenError: 'Error opening the session.',
        appStartError: 'Error starting the app',
        unknownError: 'unknown'
    },
    'es-ES': {
        heroTitle: 'Bienvenido.',
        authModes: {
            login: {
                kicker: 'Accede a tu cuenta',
                title: 'Entrar en Pluri',
                subtitle: 'Tu área financiera segura y sincronizada.'
            },
            signup: {
                kicker: 'Empieza tu control',
                title: 'Crear cuenta en Pluri',
                subtitle: 'Configura tu espacio financiero en pocos segundos.'
            },
            reset: {
                kicker: 'Recupera el acceso',
                title: 'Olvidé mi contraseña',
                subtitle: 'Informa tu email para recibir el enlace de recuperación.'
            }
        },
        heroKicker: 'Control financiero',
        heroSubtitle: 'Acompaña gastos, tarjetas y metas en un área financiera organizada para casa, pareja o uso individual.',
        heroBulletHomesTitle: 'Casas',
        heroBulletHomesText: 'Solo o pareja.',
        heroBulletCardsTitle: 'Tarjetas',
        heroBulletCardsText: 'Preferencias por persona.',
        heroBulletGoalsTitle: 'Metas',
        heroBulletGoalsText: 'Evolución clara.',
        onboardingBadge: 'Onboarding',
        onboardingHeroTitle: 'Configura tu casa financiera a tu manera.',
        onboardingHeroSubtitle: 'Define el nombre del espacio, elige si la app es solo o pareja y personaliza la estructura inicial en menos de un minuto.',
        onboardingLightTitle: 'Tema claro',
        onboardingLightText: 'Visual claro elegante desde el primer acceso, con modo oscuro disponible cuando quieras.',
        onboardingFlexibleTitle: 'Estructura flexible',
        onboardingFlexibleText: 'Solo o pareja, sin elementos sobrantes y sin quedar atrapado en un único formato.',
        onboardingKicker: 'Primera configuración',
        onboardingTitle: 'Crear mi espacio',
        onboardingSubtitle: 'Estas elecciones definen la base de tu Pluri y pueden cambiarse después en configuración.',
        onboardingAppNameLabel: 'Nombre de la app',
        onboardingStructureLabel: 'Estructura',
        onboardingCouple: 'Pareja',
        onboardingSolo: 'Solo',
        onboardingCardsLabel: 'Tarjetas iniciales',
        onboardingCardsPlaceholder: 'Ej: Nubank, Inter, C6',
        onboardingClosingDayLabel: 'Cierre del mes',
        onboardingClosingDayPlaceholder: 'Día de cierre. Ej: 10',
        onboardingCategoriesLabel: 'Categorías más usadas',
        onboardingGoalLabel: 'Objetivo financiero',
        onboardingGoalPlaceholder: 'Ej: Ahorrar para viaje',
        onboardingGoalTargetPlaceholder: 'Meta opcional $',
        onboardingCreate: 'Crear mi casa',
        onboardingRequired: 'Completa los campos obligatorios.',
        onboardingCreating: 'Creando estructura inicial...',
        onboardingCreateError: 'No fue posible crear la casa.',
        login: 'Entrar',
        signup: 'Crear cuenta',
        reset: 'Recuperar',
        sendLink: 'Enviar enlace',
        createAccount: 'Crear cuenta',
        google: 'Continuar con Google',
        logoutConfirm: '¿Estás seguro de que quieres salir?',
        logoutTitle: '¿Salir de la cuenta?',
        logoutCancel: 'Seguir conectado',
        logoutConfirmAction: 'Sí, salir',
        deleteAccountTitle: '¿Eliminar cuenta?',
        deleteAccountText: 'Esto elimina tu cuenta y los datos vinculados. No se puede deshacer.',
        deleteAccountButton: 'Eliminar cuenta',
        deleteAccountCancel: 'Cancelar',
        deleteAccountConfirm: 'Sí, eliminar',
        deleteAccountMissingRpc: 'La función delete_my_account aún no existe en Supabase. Ejecuta el SQL para eliminar cuenta.',
        fixed: 'Fijo',
        installment: 'En cuotas',
        installmentsLabel: 'Cuotas',
        installmentsPlaceholder: 'Ej: 6',
        installmentHint: 'El valor informado se repetirá mensualmente por cuota.',
        installmentInvalid: 'Informa al menos 2 cuotas.',
        installmentsFilter: 'Cuotas',
        installmentOf: 'Cuota {current} de {total}',
        installmentGroupLabel: 'Grupo de cuotas',
        installmentGroupProgress: '{paid} de {total} cuotas registradas',
        editFutureInstallments: 'Aplicar a esta y a las próximas cuotas',
        cancelFutureInstallments: 'Cancelar cuotas futuras',
        cancelFutureInstallmentsTitle: '¿Cancelar cuotas futuras?',
        futureInstallmentsCanceled: 'Cuotas futuras canceladas.',
        noInstallmentsFound: 'No se encontraron cuotas.',
        updatePassword: 'Actualizar contraseña',
        settingsKicker: 'Preferencias',
        settingsTitle: 'Configuración',
        languageLabel: 'Idioma',
        appProfileLabel: 'Perfil de la app',
        savingsGoalLabel: 'Meta de ahorro',
        categoryBudgetsLabel: 'Presupuestos por categoría',
        categoryBudgetsHint: 'Define límites mensuales. Deja 0 para no seguir la categoría.',
        monthlyDashboardTitle: 'Panel del mes',
        monthlyDashboardSubtitle: 'Acompaña tus límites por categoría y ve a dónde va el dinero.',
        monthlyDashboardNav: 'Panel',
        cardsNav: 'Tarjetas',
        cardsPageKicker: 'Tarjetas',
        cardsPageTitle: 'Mis tarjetas',
        cardsPageSubtitle: 'Ve gastos por tarjeta, factura del mes y próximas cuotas en un solo lugar.',
        cardsRegisteredLabel: 'Tarjetas activas',
        cardsTotalSpentLabel: 'Gasto en tarjetas',
        cardAddTitle: 'Agregar tarjeta',
        cardNameLabel: 'Nombre de la tarjeta',
        cardNamePlaceholder: 'Ej: Nubank PJ',
        cardLimitPlaceholder: 'Límite opcional $',
        cardClosingPlaceholder: 'Cierre',
        cardDuePlaceholder: 'Vencimiento',
        cardAddButton: 'Agregar tarjeta',
        cardManageLabel: 'Editar datos',
        cardSaveButton: 'Guardar tarjeta',
        cardCancelButton: 'Cancelar',
        cardRemoveButton: 'Eliminar',
        cardDeleteTitle: '¿Eliminar tarjeta?',
        cardDeleteText: 'Los gastos anteriores siguen guardados, pero la tarjeta sale de tu lista activa.',
        cardSaved: 'Tarjeta guardada.',
        cardRemoved: 'Tarjeta eliminada.',
        cardBillingFieldsMissing: 'Ejecuta la migración de campos de tarjeta en Supabase para guardar límite, cierre y vencimiento.',
        cardInvoiceLabel: 'Factura del mes',
        cardLimitLabel: 'Límite',
        cardClosingLabel: 'Cierre',
        cardNextInstallmentsLabel: 'Próximas cuotas',
        cardExpensesLabel: 'Gastos de la tarjeta',
        cardNoCards: 'Agrega una tarjeta en configuración para acompañar facturas y cuotas.',
        cardNoExpenses: 'Todavía no hay gastos en esta tarjeta.',
        cardNoInstallments: 'Sin próximas cuotas.',
        cardLimitNotSet: 'Sin límite',
        cardClosingNotSet: 'No definido',
        monthlyDashboardKicker: 'Resumen inteligente',
        monthlyTotalLabel: 'Gasto del mes',
        monthlyPreviousLabel: 'Mes anterior',
        monthlyDailyLabel: 'Evolución diaria',
        monthlyCategoryLabel: 'Distribución por categoría',
        monthlyBudgetHealthLabel: 'Salud de presupuestos',
        monthlyPeriodLabel: 'Periodo',
        monthlyTopDayLabel: 'Día más caro',
        monthlyNoData: 'Todavía no hay datos para este mes.',
        monthlyChangeUp: 'por encima del mes anterior',
        monthlyChangeDown: 'por debajo del mes anterior',
        monthlyChangeFlat: 'igual al mes anterior',
        monthlyAdjustLimits: 'Ajustar límites',
        monthlyInsightsLabel: 'Lectura del mes',
        monthlyInsightsTitle: 'Lo que merece tu atención',
        monthlyInsightEmpty: 'Cuando registres algunos movimientos, Pluri mostrará alertas y oportunidades aquí.',
        monthlyInsightBudgetExceededTitle: 'Límite superado',
        monthlyInsightBudgetExceededText: 'superó el límite en',
        monthlyInsightBudgetWarningTitle: 'Cerca del límite',
        monthlyInsightWarningText: 'ya consumió',
        monthlyInsightTopCategoryTitle: 'Categoría dominante',
        monthlyInsightTopCategoryText: 'concentra',
        monthlyInsightTopCategorySuffix: 'de los gastos del mes.',
        monthlyInsightMonthUpTitle: 'Mes más pesado',
        monthlyInsightMonthDownTitle: 'Mes más liviano',
        monthlyInsightMonthChangeText: 'en relación con el mes anterior.',
        monthlyInsightBigDayTitle: 'Pico de gastos',
        monthlyInsightBigDayText: 'fue el día con mayor salida.',
        monthlyInsightNoBudgetTitle: 'Define tus límites',
        monthlyInsightNoBudgetText: 'Agregar límites por categoría hace el panel más útil y ayuda a evitar sorpresas.',
        monthlyInsightStableTitle: 'Todo bajo control',
        monthlyInsightStableText: 'No apareció ninguna alerta importante este mes. Sigue acompañando para mantener el ritmo.',
        budgetAlertExceeded: 'superó el presupuesto del mes',
        budgetAlertWarning: 'ya consumió',
        budgetAlertOfLimit: 'del límite',
        notificationsKicker: 'Notificaciones',
        notificationsTitle: 'Atención financiera',
        notificationsEmpty: 'No hay alertas importantes ahora.',
        notificationMonthClosing: 'El mes está cerca de cerrar. Revisa tus gastos y mira el panel mensual.',
        notificationGoalWarning: 'Tu meta está cerca del límite planeado.',
        notificationInvoiceSoon: 'Factura llegando',
        notificationSummaryReady: 'Tu resumen financiero ya se puede revisar.',
        budgetUsed: 'usado',
        budgetNoLimit: 'Sin límite definido',
        budgetSafe: 'Dentro del límite',
        budgetWarning: 'Cerca del límite',
        budgetExceeded: 'Límite superado',
        activateGoal: 'Activar meta',
        myCardsLabel: 'Mis tarjetas',
        syncLabel: 'Sincronización',
        syncButton: 'Sincronizar con la nube',
        close: 'Cerrar',
        saveAll: 'Guardar todo',
        namePlaceholder: 'Tu nombre',
        emailPlaceholder: 'tu@email.com',
        passwordPlaceholder: 'Tu contraseña',
        confirmPasswordPlaceholder: 'Confirmar contraseña',
        newPasswordPlaceholder: 'Nueva contraseña',
        confirmNewPasswordPlaceholder: 'Confirmar nueva contraseña',
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
        historySubtitle: 'Navega tus registros con una lectura más limpia, rápida y cómoda.',
        newExpenseKicker: 'Nuevo gasto',
        newExpenseTitle: 'Agregar movimiento',
        newExpenseSubtitle: 'Entrada rápida, categorías visuales y selección de pagador sin fricción.',
        registerExpense: 'Registrar gasto',
        descriptionPlaceholder: 'Descripción...',
        cardMethod: 'Tarjeta',
        selectCard: 'Seleccionar tarjeta',
        noExpenses: 'Tus movimientos aparecerán aquí.',
        metaOff: 'Meta Off',
        saving: 'Guardando...',
        personOne: 'Persona 1',
        personTwo: 'Persona 2',
        edit: 'Editar',
        delete: 'Eliminar',
        appHeaderKicker: 'Panel Pluri',
        appHeaderSubtitle: 'Acompaña tus gastos en un espacio más claro, ligero y agradable.',
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
        summaryReadyTitle: 'Tu resumen financiero está listo',
        summaryReadyText: 'Mira cómo cerraron tus gastos este mes y dónde puedes ajustar antes del próximo ciclo.',
        summaryOpen: 'Ver resumen',
        summaryTest: 'Probar resumen',
        summaryDismiss: 'Luego',
        summaryTitle: 'Resumen financiero',
        summarySubtitle: 'Una lectura rápida de tu mes actual.',
        summaryTotal: 'Total del mes',
        summaryAverage: 'Promedio por movimiento',
        summaryTopCategory: 'Mayor categoría',
        summaryNoCategory: 'Sin categoría',
        summaryTransactions: 'Movimientos',
        settings: 'Configuración',
        export: 'Exportar',
        logout: 'Salir',
        colorLabel: 'Color',
        defaultColor: 'Predeterminado',
        useDefaultColor: 'Usar predeterminado',
        exportTitle: 'Exportar informe',
        exportSubtitle: 'Elige el mejor formato para descargar o compartir tus movimientos filtrados.',
        exportCsv: 'Planilla CSV',
        exportPdf: 'PDF visual',
        exportTxt: 'Texto TXT',
        exportXls: 'Excel XLS',
        exportWhatsapp: 'WhatsApp',
        exportEmpty: 'No hay movimientos para exportar.',
        exportReportHeading: 'INFORME FINANCIERO',
        exportHeaderDate: 'Fecha',
        exportHeaderPayer: 'Pagador',
        exportHeaderCategory: 'Categoría',
        exportHeaderMethod: 'Método',
        exportHeaderDescription: 'Descripción',
        exportHeaderAmount: 'Valor',
        accountLabel: 'Cuenta',
        soloModeHint: 'En modo solo, la segunda persona queda oculta de la interfaz.',
        deleteRecordTitle: '¿Eliminar registro?',
        no: 'No',
        yes: 'Sí',
        editExpenseTitle: 'Editar gasto',
        payerLabel: 'Pagador',
        categoryLabel: 'Categoría',
        methodLabel: 'Método',
        amountLabel: 'Valor ($)',
        dateLabel: 'Fecha',
        updatedAvailable: 'Nueva versión disponible',
        update: 'Actualizar',
        setupTitle: 'Configurar Supabase',
        setupText: 'Completa `supabase-config.js` con la URL y la anon key del proyecto `Pluri` para habilitar login y onboarding.',
        setupHint: 'Cuando guardes el archivo y recargues la página, la app usará el nuevo proyecto automáticamente.',
        defineNewPassword: 'Define tu nueva contraseña.',
        signingIn: 'Entrando...',
        loginSuccessTitle: '¡Login realizado con éxito!',
        loginSuccessText: 'Todo listo. Estamos preparando tu Pluri.',
        loadingDashboard: 'Cargando panel...',
        creating: 'Creando...',
        sending: 'Enviando...',
        passwordMismatch: 'Las contraseñas no coinciden.',
        accountCreated: 'Cuenta creada. Revisa tu email para confirmar el acceso.',
        resetLinkSent: 'Enviamos el enlace de recuperación a tu email.',
        accountOpenError: 'Error al abrir tu cuenta.',
        passwordUpdated: 'Contraseña actualizada con éxito. Abriendo la app...',
        expenseSaved: '¡Gasto registrado!',
        expenseEdited: '¡Gasto editado!',
        emptyExpensesTitle: 'Nada por aquí todavía',
        emptyExpensesText: 'Registra un movimiento para empezar a ver tu historial con claridad.',
        emptyInstallmentsTitle: 'No se encontraron cuotas',
        emptyInstallmentsText: 'Cuando crees un gasto en cuotas, el grupo aparecerá aquí.',
        configSaved: '¡Configuración guardada!',
        supabaseRequired: 'Configura Supabase para guardar gastos.',
        sessionUpdateError: 'Error al actualizar la sesión.',
        sessionOpenError: 'Error al abrir la sesión.',
        appStartError: 'Error al iniciar la app',
        unknownError: 'desconocido'
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
    const text = translations[currentLanguage] || translations['pt-BR'];
    document.querySelectorAll('.filtro-option').forEach((option) => {
        const value = option.dataset.value;
        if (value === 'installments') {
            option.innerText = text.installmentsFilter;
            return;
        }
        const index = value === 'all' ? 0 : Number(value);
        option.innerText = months[index] || option.innerText;
    });
    const selected = $('filtroMes')?.value || 'all';
    if (selected === 'installments') {
        if ($('filtroSelecionadoText')) $('filtroSelecionadoText').innerText = text.installmentsFilter;
        return;
    }
    const selectedIndex = selected === 'all' ? 0 : Number(selected);
    if ($('filtroSelecionadoText')) $('filtroSelecionadoText').innerText = months[selectedIndex] || months[0];
}

function setLanguage(language) {
    currentLanguage = translations[language] ? language : 'pt-BR';
    localStorage.setItem('pluri_language', currentLanguage);
    const text = translations[currentLanguage];
    const authCopy = getAuthModeCopy(text);

    if ($('languageSelect')) $('languageSelect').value = currentLanguage;
    const names = languageNames[currentLanguage] || languageNames['pt-BR'];
    document.querySelectorAll('.language-option').forEach((option) => {
        option.innerText = names[option.dataset.value] || option.innerText.trim();
        option.dataset.label = names[option.dataset.value] || option.dataset.label || option.innerText.trim();
        const active = option.dataset.value === currentLanguage;
        option.classList.toggle('active', active);
        if (active && $('languageSelectText')) $('languageSelectText').innerText = option.dataset.label || option.innerText.trim();
    });
    document.querySelectorAll('#languageSelect option').forEach((option) => {
        option.innerText = names[option.value] || option.innerText;
    });
    updateThemeLabels();
    if ($('setupTitle')) $('setupTitle').innerText = text.setupTitle;
    if ($('setupText')) $('setupText').innerText = text.setupText;
    if ($('setupHint')) $('setupHint').innerText = text.setupHint;
    if ($('authHeroKicker')) $('authHeroKicker').innerText = text.heroKicker;
    if ($('authHeroTitle')) $('authHeroTitle').innerText = text.heroTitle;
    if ($('authHeroSubtitle')) $('authHeroSubtitle').innerText = text.heroSubtitle;
    if ($('heroBulletHomesTitle')) $('heroBulletHomesTitle').innerText = text.heroBulletHomesTitle;
    if ($('heroBulletHomesText')) $('heroBulletHomesText').innerText = text.heroBulletHomesText;
    if ($('heroBulletCardsTitle')) $('heroBulletCardsTitle').innerText = text.heroBulletCardsTitle;
    if ($('heroBulletCardsText')) $('heroBulletCardsText').innerText = text.heroBulletCardsText;
    if ($('heroBulletGoalsTitle')) $('heroBulletGoalsTitle').innerText = text.heroBulletGoalsTitle;
    if ($('heroBulletGoalsText')) $('heroBulletGoalsText').innerText = text.heroBulletGoalsText;
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
    if ($('onboardingBadge')) $('onboardingBadge').innerText = text.onboardingBadge;
    if ($('onboardingHeroTitle')) $('onboardingHeroTitle').innerText = text.onboardingHeroTitle;
    if ($('onboardingHeroSubtitle')) $('onboardingHeroSubtitle').innerText = text.onboardingHeroSubtitle;
    if ($('onboardingLightTitle')) $('onboardingLightTitle').innerText = text.onboardingLightTitle;
    if ($('onboardingLightText')) $('onboardingLightText').innerText = text.onboardingLightText;
    if ($('onboardingFlexibleTitle')) $('onboardingFlexibleTitle').innerText = text.onboardingFlexibleTitle;
    if ($('onboardingFlexibleText')) $('onboardingFlexibleText').innerText = text.onboardingFlexibleText;
    if ($('onboardingKicker')) $('onboardingKicker').innerText = text.onboardingKicker;
    if ($('onboardingTitle')) $('onboardingTitle').innerText = text.onboardingTitle;
    if ($('onboardingSubtitle')) $('onboardingSubtitle').innerText = text.onboardingSubtitle;
    const onboardingBrand = $('onboardingOverlay')?.querySelector('.brand-panel');
    const onboardingCard = $('onboardingOverlay')?.querySelector('.onboarding-card');
    if (onboardingBrand) {
        const brandParagraphs = onboardingBrand.querySelectorAll('p');
        if (brandParagraphs[0]) brandParagraphs[0].innerText = text.onboardingHeroSubtitle;
        if (brandParagraphs[2]) brandParagraphs[2].innerText = text.onboardingLightText;
        if (brandParagraphs[3]) brandParagraphs[3].innerText = text.onboardingFlexibleTitle;
        if (brandParagraphs[4]) brandParagraphs[4].innerText = text.onboardingFlexibleText;
    }
    if (onboardingCard) {
        const cardKicker = onboardingCard.querySelector('.kicker');
        const cardTitle = onboardingCard.querySelector('h3');
        const cardSubtitle = onboardingCard.querySelector('h3 + p');
        if (cardKicker) cardKicker.innerText = text.onboardingKicker;
        if (cardTitle) cardTitle.innerText = text.onboardingTitle;
        if (cardSubtitle) cardSubtitle.innerText = text.onboardingSubtitle;
    }
    if ($('onboardingAppNameLabel')) $('onboardingAppNameLabel').innerText = text.onboardingAppNameLabel;
    if ($('onboardingStructureLabel')) $('onboardingStructureLabel').innerText = text.onboardingStructureLabel;
    if ($('onboardingModeCouple')) $('onboardingModeCouple').innerText = text.onboardingCouple;
    if ($('onboardingModeSolo')) $('onboardingModeSolo').innerText = text.onboardingSolo;
    if ($('onboardingCardsLabel')) $('onboardingCardsLabel').innerText = text.onboardingCardsLabel;
    if ($('onboardingClosingDayLabel')) $('onboardingClosingDayLabel').innerText = text.onboardingClosingDayLabel;
    if ($('onboardingCategoriesLabel')) $('onboardingCategoriesLabel').innerText = text.onboardingCategoriesLabel;
    if ($('onboardingGoalLabel')) $('onboardingGoalLabel').innerText = text.onboardingGoalLabel;
    if ($('onboardingPessoa1Label')) $('onboardingPessoa1Label').innerText = text.memberOnePlaceholder;
    if ($('onboardingPessoa2Label')) $('onboardingPessoa2Label').innerText = text.memberTwoPlaceholder;
    if ($('onboardingSubmitBtn')) $('onboardingSubmitBtn').innerText = text.onboardingCreate;
    if ($('fixedLabel')) $('fixedLabel').innerText = text.fixed;
    if ($('installmentLabel')) $('installmentLabel').innerText = text.installment;
    if ($('installmentsFieldLabel')) $('installmentsFieldLabel').innerText = text.installmentsLabel;
    if ($('installmentsCount')) $('installmentsCount').placeholder = text.installmentsPlaceholder;
    if ($('installmentHint')) $('installmentHint').innerText = text.installmentHint;
    if ($('editFutureInstallmentsLabel')) $('editFutureInstallmentsLabel').innerText = text.editFutureInstallments;
    if ($('cancelFutureInstallmentsBtn')) $('cancelFutureInstallmentsBtn').innerText = text.cancelFutureInstallments;
    if ($('settingsKicker')) $('settingsKicker').innerText = text.settingsKicker;
    if ($('settingsTitle')) $('settingsTitle').innerText = text.settingsTitle;
    if ($('settingsLanguageLabel')) $('settingsLanguageLabel').innerText = text.languageLabel;
    if ($('settingsAppProfileLabel')) $('settingsAppProfileLabel').innerText = text.appProfileLabel;
    if ($('settingsGoalLabel')) $('settingsGoalLabel').innerText = text.savingsGoalLabel;
    if ($('categoryBudgetsLabel')) $('categoryBudgetsLabel').innerText = text.categoryBudgetsLabel;
    if ($('categoryBudgetsHint')) $('categoryBudgetsHint').innerText = text.categoryBudgetsHint;
    if ($('monthlyDashboardTitle')) $('monthlyDashboardTitle').innerText = text.monthlyDashboardTitle;
    if ($('monthlyDashboardSubtitle')) $('monthlyDashboardSubtitle').innerText = text.monthlyDashboardSubtitle;
    if ($('monthlyDashboardPageKicker')) $('monthlyDashboardPageKicker').innerText = text.monthlyDashboardKicker;
    if ($('monthlyTotalLabel')) $('monthlyTotalLabel').innerText = text.monthlyTotalLabel;
    if ($('monthlyPreviousLabel')) $('monthlyPreviousLabel').innerText = text.monthlyPreviousLabel;
    if ($('monthlyTopCategoryLabel')) $('monthlyTopCategoryLabel').innerText = text.summaryTopCategory;
    if ($('monthlyTopDayLabel')) $('monthlyTopDayLabel').innerText = text.monthlyTopDayLabel;
    if ($('monthlyDailyLabel')) $('monthlyDailyLabel').innerText = text.monthlyDailyLabel;
    if ($('monthlyCategoryLabel')) $('monthlyCategoryLabel').innerText = text.monthlyCategoryLabel;
    if ($('monthlyBudgetHealthLabel')) $('monthlyBudgetHealthLabel').innerText = text.monthlyBudgetHealthLabel;
    if ($('monthlyPeriodLabel')) $('monthlyPeriodLabel').innerText = text.monthlyPeriodLabel;
    if ($('monthlyAdjustLimitsBtn')) $('monthlyAdjustLimitsBtn').innerText = text.monthlyAdjustLimits;
    if ($('monthlyInsightsLabel')) $('monthlyInsightsLabel').innerText = text.monthlyInsightsLabel;
    if ($('monthlyInsightsTitle')) $('monthlyInsightsTitle').innerText = text.monthlyInsightsTitle;
    if ($('cardsPageKicker')) $('cardsPageKicker').innerText = text.cardsPageKicker;
    if ($('cardsPageTitle')) $('cardsPageTitle').innerText = text.cardsPageTitle;
    if ($('cardsPageSubtitle')) $('cardsPageSubtitle').innerText = text.cardsPageSubtitle;
    if ($('cardsRegisteredLabel')) $('cardsRegisteredLabel').innerText = text.cardsRegisteredLabel;
    if ($('cardsTotalSpentLabel')) $('cardsTotalSpentLabel').innerText = text.cardsTotalSpentLabel;
    if ($('cardAddTitle')) $('cardAddTitle').innerText = text.cardAddTitle;
    if ($('cardNameLabel')) $('cardNameLabel').innerText = text.cardNameLabel;
    if ($('newCardName')) $('newCardName').placeholder = text.cardNamePlaceholder;
    if ($('newCardLimit')) $('newCardLimit').placeholder = text.cardLimitPlaceholder;
    if ($('newCardClosingDay')) $('newCardClosingDay').placeholder = text.cardClosingPlaceholder;
    if ($('newCardDueDay')) $('newCardDueDay').placeholder = text.cardDuePlaceholder;
    if ($('cardAddButton')) $('cardAddButton').innerText = text.cardAddButton;
    if ($('cardsNextInstallmentsTitle')) $('cardsNextInstallmentsTitle').innerText = text.cardNextInstallmentsLabel;
    if ($('notificationsKicker')) $('notificationsKicker').innerText = text.notificationsKicker;
    if ($('notificationsTitle')) $('notificationsTitle').innerText = text.notificationsTitle;
    if ($('settingsActivateGoalLabel')) $('settingsActivateGoalLabel').innerText = text.activateGoal;
    if ($('dangerAccountLabel')) $('dangerAccountLabel').innerText = text.accountLabel;
    if ($('btnModeCouple')) $('btnModeCouple').innerText = text.onboardingCouple;
    if ($('btnModeSolo')) $('btnModeSolo').innerText = text.onboardingSolo;
    if ($('settingsCloseBtn')) $('settingsCloseBtn').innerText = text.close;
    if ($('settingsSaveBtn')) $('settingsSaveBtn').innerText = text.saveAll;
    if ($('deleteAccountSettingsBtn')) $('deleteAccountSettingsBtn').innerText = text.deleteAccountButton;
    if ($('authName')) $('authName').placeholder = text.namePlaceholder;
    if ($('authEmail')) $('authEmail').placeholder = text.emailPlaceholder;
    if ($('authPassword')) $('authPassword').placeholder = text.passwordPlaceholder;
    if ($('authPasswordConfirm')) $('authPasswordConfirm').placeholder = text.confirmPasswordPlaceholder;
    if ($('authIncome')) $('authIncome').placeholder = text.incomePlaceholder;
    if ($('onboardingAppName')) $('onboardingAppName').placeholder = text.appNamePlaceholder;
    if ($('onboardingCards')) $('onboardingCards').placeholder = text.onboardingCardsPlaceholder;
    if ($('onboardingClosingDay')) $('onboardingClosingDay').placeholder = text.onboardingClosingDayPlaceholder;
    if ($('onboardingGoalName')) $('onboardingGoalName').placeholder = text.onboardingGoalPlaceholder;
    if ($('onboardingGoalTarget')) $('onboardingGoalTarget').placeholder = text.onboardingGoalTargetPlaceholder;
    if ($('onboardingPessoa1')) $('onboardingPessoa1').placeholder = text.namePlaceholder;
    if ($('onboardingPessoa2')) $('onboardingPessoa2').placeholder = text.memberTwoPlaceholder;
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
        renderBudgetSettings();
        renderMonthlyDashboard();
        updateSeletorCartaoForm();
        render();
    }
    if ($('onboardingOverlay') && !$('onboardingOverlay').classList.contains('hidden')) renderOnboardingCategories();
    if ($('appHeaderKicker')) $('appHeaderKicker').innerText = text.appHeaderKicker;
    if ($('appHeaderSubtitle')) $('appHeaderSubtitle').innerText = text.appHeaderSubtitle;
    if ($('mobileMenuHome')) $('mobileMenuHome').innerText = text.home;
    if ($('mobileMenuDashboard')) $('mobileMenuDashboard').innerText = text.monthlyDashboardNav;
    if ($('mobileMenuCards')) $('mobileMenuCards').innerText = text.cardsNav;
    if ($('mobileMenuProfile')) $('mobileMenuProfile').innerText = text.profile;
    if ($('mobileMenuSettings')) $('mobileMenuSettings').innerText = text.settings;
    if ($('mobileMenuMore')) $('mobileMenuMore').innerText = text.settings;
    if ($('mobileMenuExport')) $('mobileMenuExport').innerText = text.export;
    if ($('mobileMenuLogout')) $('mobileMenuLogout').innerText = text.logout;
    if ($('menuHome')) $('menuHome').innerText = text.home;
    if ($('menuProfile')) $('menuProfile').innerText = text.profile;
    if ($('menuDashboard')) $('menuDashboard').innerText = text.monthlyDashboardNav;
    if ($('menuCards')) $('menuCards').innerText = text.cardsNav;
    if ($('soloModeHint')) $('soloModeHint').innerText = text.soloModeHint;
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
    if ($('loginSuccessTitle')) $('loginSuccessTitle').innerText = text.loginSuccessTitle;
    if ($('loginSuccessText')) $('loginSuccessText').innerText = text.loginSuccessText;
    if ($('deleteCardModalTitle')) $('deleteCardModalTitle').innerText = text.cardDeleteTitle;
    if ($('deleteCardModalText')) $('deleteCardModalText').innerText = text.cardDeleteText;
    if ($('deleteCardModalCancel')) $('deleteCardModalCancel').innerText = text.cardCancelButton;
    if ($('deleteCardModalConfirm')) $('deleteCardModalConfirm').innerText = text.cardRemoveButton;
    if ($('deleteAccountModalTitle')) $('deleteAccountModalTitle').innerText = text.deleteAccountTitle;
    if ($('deleteAccountModalText')) $('deleteAccountModalText').innerText = text.deleteAccountText;
    if ($('deleteAccountModalCancel')) $('deleteAccountModalCancel').innerText = text.deleteAccountCancel;
    if ($('deleteAccountModalConfirm')) $('deleteAccountModalConfirm').innerText = text.deleteAccountConfirm;
    if ($('deleteRecordTitle')) $('deleteRecordTitle').innerText = text.deleteRecordTitle;
    if ($('deleteRecordCancel')) $('deleteRecordCancel').innerText = text.no;
    const deleteCancelButton = $('modalDelete')?.querySelector('.ghost-button');
    if (deleteCancelButton) deleteCancelButton.innerText = text.no;
    if ($('confirmDeleteBtn')) $('confirmDeleteBtn').innerText = text.yes;
    if ($('editExpenseTitle')) $('editExpenseTitle').innerText = text.editExpenseTitle;
    if ($('editDescriptionLabel')) $('editDescriptionLabel').innerText = text.exportHeaderDescription;
    if ($('editAmountLabel')) $('editAmountLabel').innerText = text.amountLabel;
    if ($('editDateLabel')) $('editDateLabel').innerText = text.dateLabel;
    if ($('editPayerLabel')) $('editPayerLabel').innerText = text.payerLabel;
    if ($('editCategoryLabel')) $('editCategoryLabel').innerText = text.categoryLabel;
    if ($('editMethodLabel')) $('editMethodLabel').innerText = text.methodLabel;
    if ($('editCardLabel')) $('editCardLabel').innerText = text.cardMethod;
    if ($('editCancelBtn')) $('editCancelBtn').innerText = text.deleteAccountCancel;
    if ($('btnSalvarEdicao')) $('btnSalvarEdicao').innerText = text.close === 'Close' ? 'Save' : text.close === 'Cerrar' ? 'Guardar' : 'Salvar';
    const editModal = $('modalEdit');
    if (editModal) {
        const title = editModal.querySelector('h2');
        const labels = editModal.querySelectorAll('label');
        const cancelButton = editModal.querySelector('.ghost-button');
        if (title) title.innerText = text.editExpenseTitle;
        [
            text.exportHeaderDescription,
            text.amountLabel,
            text.dateLabel,
            text.payerLabel,
            text.categoryLabel,
            text.methodLabel,
            text.cardMethod
        ].forEach((label, index) => {
            if (labels[index]) labels[index].innerText = label;
        });
        if (cancelButton) cancelButton.innerText = text.deleteAccountCancel;
    }
    if ($('person1ColorLabel')) $('person1ColorLabel').innerText = text.colorLabel;
    if ($('person2ColorLabel')) $('person2ColorLabel').innerText = text.colorLabel;
    if ($('person1ColorDefaultBtn')) $('person1ColorDefaultBtn').innerText = text.useDefaultColor;
    if ($('person2ColorDefaultBtn')) $('person2ColorDefaultBtn').innerText = text.useDefaultColor;
    if ($('exportModalKicker')) $('exportModalKicker').innerText = text.export;
    if ($('exportModalTitle')) $('exportModalTitle').innerText = text.exportTitle;
    if ($('exportModalSubtitle')) $('exportModalSubtitle').innerText = text.exportSubtitle;
    if ($('exportCsvLabel')) $('exportCsvLabel').innerText = text.exportCsv;
    if ($('exportPdfLabel')) $('exportPdfLabel').innerText = text.exportPdf;
    if ($('exportTxtLabel')) $('exportTxtLabel').innerText = text.exportTxt;
    if ($('exportXlsLabel')) $('exportXlsLabel').innerText = text.exportXls;
    if ($('exportWhatsappLabel')) $('exportWhatsappLabel').innerText = text.exportWhatsapp;
    document.querySelectorAll('[data-i18n-close]').forEach((item) => item.setAttribute('aria-label', text.close));
    updateEditDropdownLabels();
    if ($('headerExportLabel')) $('headerExportLabel').innerText = text.export;
    if ($('headerSettingsLabel')) $('headerSettingsLabel').innerText = text.settings;
    if ($('logoutButton')) $('logoutButton').innerText = text.logout;
    if ($('updateBannerText')) $('updateBannerText').innerText = text.updatedAvailable;
    if ($('updateBannerButton')) $('updateBannerButton').innerText = text.update;
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
    renderMonthlyDashboard();
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
    const normalized = normalizeMetodo(value);
    return normalized.includes('cart') || normalized.includes('card') || normalized.includes('tarjeta');
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

function showToast(msg, tone = '') {
    const t = document.createElement('div');
    t.className = `toast ${tone}`.trim();
    t.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
    t.setAttribute('aria-live', tone === 'danger' ? 'assertive' : 'polite');
    t.innerText = msg;
    const container = $('toast-container');
    while (container.children.length >= 4) container.firstElementChild?.remove();
    container.appendChild(t);
    setTimeout(() => t.remove(), tone ? 5200 : 3000);
}

function getOpenModals() {
    return Array.from(document.querySelectorAll('.modal-overlay'))
        .filter((modal) => modal.style.display === 'flex');
}

function syncModalState() {
    const hasOpenModal = getOpenModals().length > 0;
    document.body.classList.toggle('modal-open', hasOpenModal);
}

function focusFirstModalElement(modal) {
    const focusable = modal.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (focusable) window.setTimeout(() => focusable.focus({ preventScroll: true }), 80);
}

function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function openModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('role', 'dialog');
    syncModalState();
    focusFirstModalElement(modal);
    if (modal.classList.contains('settings-page')) {
        requestAnimationFrame(() => modal.classList.add('is-open'));
    }
}

function closeModal(id) {
    const modal = $(id);
    if (!modal) return;
    if (modal.classList.contains('settings-page')) {
        modal.removeAttribute('aria-modal');
        modal.removeAttribute('role');
        modal.classList.remove('is-open');
        window.setTimeout(() => {
            if (!modal.classList.contains('is-open')) modal.style.display = 'none';
            syncModalState();
        }, 180);
        setMobileNavActive(getCurrentNavTarget());
        return;
    }
    modal.style.display = 'none';
    modal.removeAttribute('aria-modal');
    modal.removeAttribute('role');
    syncModalState();
    if (['modalExport', 'modalLogout'].includes(id)) setMobileNavActive(getCurrentNavTarget());
}

function getCurrentNavTarget() {
    if ($('profilePage') && !$('profilePage').classList.contains('hidden')) return 'profile';
    if ($('monthlyDashboardPage') && !$('monthlyDashboardPage').classList.contains('hidden')) return 'dashboard';
    if ($('cardsPage') && !$('cardsPage').classList.contains('hidden')) return 'cards';
    return 'home';
}

function closeAppOverlays(exceptId = '') {
    ['modalConfig', 'modalExport', 'modalMonthlySummary', 'modalEdit', 'modalDelete', 'modalLogout', 'modalDeleteAccount', 'modalDeleteCard'].forEach((id) => {
        if (id !== exceptId && $(id)) closeModal(id);
    });
    toggleLanguageDropdown(false);
    toggleAppMenu(false);
    toggleMobileMoreMenu(false);
}

function setMobileNavActive(target) {
    document.querySelectorAll('.mobile-bottom-item').forEach((item) => {
        item.classList.toggle('is-active', item.dataset.nav === target);
    });
    const moreActive = ['cards', 'profile', 'settings'].includes(target);
    const moreButton = $('mobileMoreTrigger');
    if (moreButton) moreButton.classList.toggle('is-active', moreActive);
}

function toggleMobileMoreMenu(force) {
    const menu = $('mobileMoreMenu');
    const trigger = $('mobileMoreTrigger');
    if (!menu || !trigger) return;
    const shouldOpen = force === undefined ? menu.classList.contains('hidden') : Boolean(force);
    menu.classList.toggle('hidden', !shouldOpen);
    trigger.classList.toggle('is-open', shouldOpen);
    trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
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
    toggleMobileMoreMenu(false);
    setMobileNavActive('profile');
    updateProfilePage();
    if ($('profileMessage')) $('profileMessage').innerText = '';
    if ($('dashboardPage')) $('dashboardPage').classList.add('hidden');
    if ($('monthlyDashboardPage')) $('monthlyDashboardPage').classList.add('hidden');
    if ($('cardsPage')) $('cardsPage').classList.add('hidden');
    if ($('profilePage')) $('profilePage').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMonthlyDashboardPage() {
    closeAppOverlays();
    toggleMobileMoreMenu(false);
    setMobileNavActive('dashboard');
    if ($('profilePage')) $('profilePage').classList.add('hidden');
    if ($('dashboardPage')) $('dashboardPage').classList.add('hidden');
    if ($('cardsPage')) $('cardsPage').classList.add('hidden');
    if ($('monthlyDashboardPage')) $('monthlyDashboardPage').classList.remove('hidden');
    renderMonthlyDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openCardsPage() {
    closeAppOverlays();
    toggleMobileMoreMenu(false);
    setMobileNavActive('cards');
    if ($('profilePage')) $('profilePage').classList.add('hidden');
    if ($('dashboardPage')) $('dashboardPage').classList.add('hidden');
    if ($('monthlyDashboardPage')) $('monthlyDashboardPage').classList.add('hidden');
    if ($('cardsPage')) $('cardsPage').classList.remove('hidden');
    renderCardsPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDashboardPage() {
    closeAppOverlays();
    toggleMobileMoreMenu(false);
    setMobileNavActive('home');
    if ($('profilePage')) $('profilePage').classList.add('hidden');
    if ($('monthlyDashboardPage')) $('monthlyDashboardPage').classList.add('hidden');
    if ($('cardsPage')) $('cardsPage').classList.add('hidden');
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

function getCurrentPeriodKey() {
    const today = new Date();
    return `${today.getFullYear()}-${getCurrentMonthKey()}`;
}

function getExpensePeriodKey(item) {
    if (item?.dataRaw) return String(item.dataRaw).slice(0, 7);
    const month = item?.mes || getCurrentMonthKey();
    return `${new Date().getFullYear()}-${String(month).padStart(2, '0')}`;
}

function parsePeriodKey(periodKey) {
    const [year, month] = String(periodKey || getCurrentPeriodKey()).split('-').map(Number);
    return {
        year: Number.isFinite(year) ? year : new Date().getFullYear(),
        month: Number.isFinite(month) ? month : new Date().getMonth() + 1
    };
}

function addMonthsToPeriod(periodKey, offset) {
    const period = parsePeriodKey(periodKey);
    const date = new Date(period.year, period.month - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatPeriodLabel(periodKey) {
    const period = parsePeriodKey(periodKey);
    const month = getCurrentMonths()[period.month] || String(period.month).padStart(2, '0');
    return `${month} ${period.year}`;
}

function getCurrentMonthExpenses() {
    return gastos.filter((item) => item.mes === getCurrentMonthKey());
}

function getExpensesByPeriod(periodKey) {
    const period = parsePeriodKey(periodKey);
    return gastos.filter((item) => {
        const date = item.dataRaw ? new Date(`${item.dataRaw}T00:00:00`) : null;
        if (date && !Number.isNaN(date.getTime())) {
            return date.getFullYear() === period.year && date.getMonth() === period.month - 1;
        }
        return period.year === new Date().getFullYear() && item.mes === String(period.month).padStart(2, '0');
    });
}

function getMonthExpensesByOffset(offset = 0) {
    return getExpensesByPeriod(addMonthsToPeriod(getCurrentPeriodKey(), offset));
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

function getDaysUntilMonthDay(day) {
    const parsedDay = Number(day || 0);
    if (!parsedDay) return null;
    const today = new Date();
    const candidate = new Date(today.getFullYear(), today.getMonth(), Math.min(parsedDay, 31));
    if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        candidate.setMonth(candidate.getMonth() + 1);
    }
    return Math.ceil((candidate - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

function getSmartNotifications() {
    const text = translations[currentLanguage] || translations['pt-BR'];
    const notifications = [];
    const today = new Date();
    if (today.getDate() >= 25 && getMonthlySummaryData().expenses.length) {
        notifications.push({ tone: 'info', title: text.summaryTitle, body: text.notificationMonthClosing });
    }
    if (shouldShowMonthlySummaryNotice() && getMonthlySummaryData().expenses.length) {
        notifications.push({ tone: 'safe', title: text.summaryReadyTitle, body: text.notificationSummaryReady });
    }
    if (meta.ativa && meta.alvo > 0) {
        const percent = (Number(meta.atual || 0) / Number(meta.alvo || 1)) * 100;
        if (percent >= 80) {
            notifications.push({
                tone: percent >= 100 ? 'danger' : 'warning',
                title: meta.nome || text.savingsGoalLabel,
                body: `${text.notificationGoalWarning} ${Math.round(percent)}%`
            });
        }
    }
    currentCards.forEach((card) => {
        const closing = getCardMetaValue(card, ['closing_day', 'statement_closing_day', 'due_day']);
        const days = getDaysUntilMonthDay(closing);
        if (days !== null && days <= 3) {
            notifications.push({
                tone: 'warning',
                title: `${text.notificationInvoiceSoon}: ${card.name}`,
                body: `${text.cardClosingLabel}: ${String(closing).padStart(2, '0')}`
            });
        }
    });
    return notifications.slice(0, 4);
}

function renderSmartNotifications() {
    const list = $('smartNotificationsList');
    const section = $('smartNotifications');
    if (!list || !section) return;
    const text = translations[currentLanguage] || translations['pt-BR'];
    const notifications = getSmartNotifications();
    list.innerHTML = notifications.length
        ? notifications.map((item) => `
            <div class="smart-notification ${item.tone}">
                <span></span>
                <div>
                    <strong>${escapeHtml(item.title)}</strong>
                    <p>${escapeHtml(item.body)}</p>
                </div>
            </div>
        `).join('')
        : `<div class="card-expense-empty">${escapeHtml(text.notificationsEmpty)}</div>`;
}

function getCurrentMonthTotalByCategory() {
    return getCurrentMonthExpenses().reduce((totals, item) => {
        totals[item.categoria] = (totals[item.categoria] || 0) + Number(item.valor || 0);
        return totals;
    }, {});
}

function getMonthlyCategoryTotals(expenses) {
    return expenses.reduce((totals, item) => {
        totals[item.categoria] = (totals[item.categoria] || 0) + Number(item.valor || 0);
        return totals;
    }, {});
}

function getMonthlyDailyTotals(expenses, periodKey = getCurrentPeriodKey()) {
    const period = parsePeriodKey(periodKey);
    const daysInMonth = new Date(period.year, period.month, 0).getDate();
    const totals = Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, total: 0 }));
    expenses.forEach((item) => {
        const date = item.dataRaw ? new Date(`${item.dataRaw}T00:00:00`) : null;
        if (!date || Number.isNaN(date.getTime())) return;
        const dayIndex = date.getDate() - 1;
        if (totals[dayIndex]) totals[dayIndex].total += Number(item.valor || 0);
    });
    return totals;
}

function getBudgetStatus(spent, limit) {
    const text = translations[currentLanguage] || translations['pt-BR'];
    if (!limit || limit <= 0) return { label: text.budgetNoLimit, tone: 'muted', percent: 0 };
    const percent = Math.min((spent / limit) * 100, 160);
    if (spent > limit) return { label: text.budgetExceeded, tone: 'danger', percent };
    if (percent >= 80) return { label: text.budgetWarning, tone: 'warning', percent };
    return { label: text.budgetSafe, tone: 'safe', percent };
}

function renderBudgetSettings() {
    const grid = $('categoryBudgetsGrid');
    if (!grid) return;
    grid.innerHTML = categories.map((cat) => `
        <label class="budget-input-card">
            <span>${escapeHtml(getCategoryLabel(cat.id))}</span>
            <input type="number" id="budget-${cat.id}" min="0" step="0.01" inputmode="decimal" class="input-vr" value="${Number(categoryBudgets[cat.id] || 0) || ''}" placeholder="0,00">
        </label>
    `).join('');
}

function getPreferredCategoryOrder() {
    try {
        return JSON.parse(localStorage.getItem('pluri_preferred_categories') || '[]');
    } catch (error) {
        return [];
    }
}

function getOrderedCategories() {
    const preferred = getPreferredCategoryOrder();
    return categories.slice().sort((a, b) => {
        const aIndex = preferred.indexOf(a.id);
        const bIndex = preferred.indexOf(b.id);
        if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
        if (aIndex >= 0) return -1;
        if (bIndex >= 0) return 1;
        return 0;
    });
}

function getBudgetAlertForCategory(categoryId) {
    const limit = Number(categoryBudgets[categoryId] || 0);
    if (!limit || limit <= 0) return null;
    const text = translations[currentLanguage] || translations['pt-BR'];
    const spent = Number(getCurrentMonthTotalByCategory()[categoryId] || 0);
    const percent = Math.round((spent / limit) * 100);
    const currency = (value) => `R$ ${Number(value || 0).toLocaleString(getCurrentLocale(), { minimumFractionDigits: 2 })}`;
    if (spent > limit) {
        return {
            tone: 'danger',
            message: `${getCategoryLabel(categoryId)} ${text.budgetAlertExceeded}: ${currency(spent)} / ${currency(limit)}.`
        };
    }
    if (percent >= 80) {
        return {
            tone: 'warning',
            message: `${getCategoryLabel(categoryId)} ${text.budgetAlertWarning} ${percent}% ${text.budgetAlertOfLimit}: ${currency(spent)} / ${currency(limit)}.`
        };
    }
    return null;
}

function getAvailableDashboardPeriods() {
    const periods = Array.from(new Set([
        getCurrentPeriodKey(),
        ...gastos.map(getExpensePeriodKey).filter(Boolean)
    ]));
    return periods.sort((a, b) => b.localeCompare(a));
}

function renderMonthlyPeriodSelect() {
    const select = $('monthlyPeriodSelect');
    if (!select) return;
    const periods = getAvailableDashboardPeriods();
    if (!monthlyDashboardPeriod || !periods.includes(monthlyDashboardPeriod)) {
        monthlyDashboardPeriod = periods.includes(getCurrentPeriodKey()) ? getCurrentPeriodKey() : periods[0] || getCurrentPeriodKey();
    }
    select.innerHTML = periods.map((period) => `
        <option value="${escapeHtml(period)}">${escapeHtml(formatPeriodLabel(period))}</option>
    `).join('');
    select.value = monthlyDashboardPeriod;
}

function setMonthlyDashboardPeriod(periodKey) {
    monthlyDashboardPeriod = periodKey || getCurrentPeriodKey();
    renderMonthlyDashboard();
}

function renderMonthlyDashboard() {
    const list = $('monthlyBudgetList');
    if (!list) return;
    const text = translations[currentLanguage] || translations['pt-BR'];
    const currency = (value) => `R$ ${Number(value || 0).toLocaleString(getCurrentLocale(), { minimumFractionDigits: 2 })}`;
    renderMonthlyPeriodSelect();
    const selectedPeriod = monthlyDashboardPeriod || getCurrentPeriodKey();
    const previousPeriod = addMonthsToPeriod(selectedPeriod, -1);
    const selectedMonth = parsePeriodKey(selectedPeriod).month;
    const currentExpenses = getExpensesByPeriod(selectedPeriod);
    const previousExpenses = getExpensesByPeriod(previousPeriod);
    const currentTotal = currentExpenses.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const previousTotal = previousExpenses.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const totals = getMonthlyCategoryTotals(currentExpenses);
    const dailyTotals = getMonthlyDailyTotals(currentExpenses, selectedPeriod);
    const topCategory = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    const topDay = dailyTotals.slice().sort((a, b) => b.total - a.total)[0];
    const limits = categories
        .map((cat) => ({ cat, spent: Number(totals[cat.id] || 0), limit: Number(categoryBudgets[cat.id] || 0) }))
        .filter((item) => item.limit > 0);
    const exceeded = limits.filter((item) => item.spent > item.limit).length;
    const warning = limits.filter((item) => item.spent <= item.limit && item.spent / item.limit >= 0.8).length;
    const healthy = limits.length ? Math.max(limits.length - exceeded - warning, 0) : 0;
    const changePercent = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
    const changeLabel = previousTotal > 0
        ? `${changePercent >= 0 ? '+' : ''}${Math.round(changePercent)}% ${changePercent > 0 ? text.monthlyChangeUp : changePercent < 0 ? text.monthlyChangeDown : text.monthlyChangeFlat}`
        : text.monthlyNoData;

    if ($('monthlyTotalValue')) $('monthlyTotalValue').innerText = currency(currentTotal);
    if ($('monthlyPreviousValue')) $('monthlyPreviousValue').innerText = currency(previousTotal);
    if ($('monthlyPreviousHint')) $('monthlyPreviousHint').innerText = changeLabel;
    if ($('monthlyTopCategoryValue')) {
        $('monthlyTopCategoryValue').innerText = topCategory ? getCategoryLabel(topCategory[0]) : text.monthlyNoData;
    }
    if ($('monthlyTopCategoryHint')) {
        $('monthlyTopCategoryHint').innerText = topCategory ? currency(topCategory[1]) : '';
    }
    if ($('monthlyTopDayValue')) {
        $('monthlyTopDayValue').innerText = topDay && topDay.total > 0 ? `${String(topDay.day).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}` : text.monthlyNoData;
    }
    if ($('monthlyTopDayHint')) {
        $('monthlyTopDayHint').innerText = topDay && topDay.total > 0 ? currency(topDay.total) : '';
    }
    if ($('monthlyBudgetHealthValue')) {
        $('monthlyBudgetHealthValue').innerText = limits.length ? `${healthy}/${limits.length}` : text.budgetNoLimit;
    }
    if ($('monthlyBudgetHealthHint')) {
        const hints = [];
        if (exceeded) hints.push(`${exceeded} ${text.budgetExceeded.toLowerCase()}`);
        if (warning) hints.push(`${warning} ${text.budgetWarning.toLowerCase()}`);
        $('monthlyBudgetHealthHint').innerText = hints.length ? hints.join(' | ') : (limits.length ? text.budgetSafe : text.categoryBudgetsHint);
    }

    list.innerHTML = categories.map((cat) => {
        const spent = Number(totals[cat.id] || 0);
        const limit = Number(categoryBudgets[cat.id] || 0);
        const status = getBudgetStatus(spent, limit);
        const percentLabel = limit > 0 ? `${Math.round(Math.min((spent / limit) * 100, 999))}% ${text.budgetUsed}` : text.budgetNoLimit;
        return `
            <div class="budget-progress-row ${status.tone}">
                <div class="budget-progress-head">
                    <span>${escapeHtml(getCategoryLabel(cat.id))}</span>
                    <strong>${currency(spent)}${limit > 0 ? ` / ${currency(limit)}` : ''}</strong>
                </div>
                <div class="budget-progress-track"><span style="width:${Math.min(status.percent, 100)}%"></span></div>
                <div class="budget-progress-foot">
                    <small>${escapeHtml(status.label)}</small>
                    <small>${escapeHtml(percentLabel)}</small>
                </div>
            </div>
        `;
    }).join('');

    renderMonthlyInsights({
        text,
        currentExpenses,
        currentTotal,
        previousTotal,
        changePercent,
        totals,
        topCategory,
        topDay,
        limits,
        selectedMonth
    });
    renderMonthlyCharts(totals, dailyTotals, text);
}

function renderMonthlyInsights({ text, currentExpenses, currentTotal, previousTotal, changePercent, totals, topCategory, topDay, limits, selectedMonth }) {
    const target = $('monthlyInsightsList');
    if (!target) return;
    const currency = (value) => `R$ ${Number(value || 0).toLocaleString(getCurrentLocale(), { minimumFractionDigits: 2 })}`;
    const insights = [];
    const exceeded = limits
        .filter((item) => item.spent > item.limit)
        .sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit));
    const warning = limits
        .filter((item) => item.spent <= item.limit && item.spent / item.limit >= 0.8)
        .sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit));

    if (!currentExpenses.length) {
        insights.push({
            tone: 'neutral',
            title: text.monthlyDashboardTitle,
            body: text.monthlyInsightEmpty
        });
    }

    if (exceeded[0]) {
        const item = exceeded[0];
        insights.push({
            tone: 'danger',
            title: text.monthlyInsightBudgetExceededTitle,
            body: `${getCategoryLabel(item.cat.id)} ${text.monthlyInsightBudgetExceededText} ${currency(item.spent - item.limit)}.`
        });
    } else if (warning[0]) {
        const item = warning[0];
        insights.push({
            tone: 'warning',
            title: text.monthlyInsightBudgetWarningTitle,
            body: `${getCategoryLabel(item.cat.id)} ${text.monthlyInsightWarningText} ${Math.round((item.spent / item.limit) * 100)}% ${text.budgetUsed}.`
        });
    }

    if (topCategory && currentTotal > 0) {
        const categoryShare = Math.round((Number(topCategory[1] || 0) / currentTotal) * 100);
        if (categoryShare >= 35) {
            insights.push({
                tone: 'info',
                title: text.monthlyInsightTopCategoryTitle,
                body: `${getCategoryLabel(topCategory[0])} ${text.monthlyInsightTopCategoryText} ${categoryShare}% ${text.monthlyInsightTopCategorySuffix}`
            });
        }
    }

    if (previousTotal > 0 && Math.abs(changePercent) >= 15) {
        insights.push({
            tone: changePercent > 0 ? 'warning' : 'safe',
            title: changePercent > 0 ? text.monthlyInsightMonthUpTitle : text.monthlyInsightMonthDownTitle,
            body: `${changePercent > 0 ? '+' : ''}${Math.round(changePercent)}% ${text.monthlyInsightMonthChangeText}`
        });
    }

    if (topDay && topDay.total > 0 && currentTotal > 0 && topDay.total / currentTotal >= 0.3) {
        insights.push({
            tone: 'info',
            title: text.monthlyInsightBigDayTitle,
            body: `${String(topDay.day).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')} ${text.monthlyInsightBigDayText} ${currency(topDay.total)}.`
        });
    }

    if (!limits.length && currentExpenses.length) {
        insights.push({
            tone: 'neutral',
            title: text.monthlyInsightNoBudgetTitle,
            body: text.monthlyInsightNoBudgetText
        });
    }

    if (!insights.length) {
        insights.push({
            tone: 'safe',
            title: text.monthlyInsightStableTitle,
            body: text.monthlyInsightStableText
        });
    }

    target.innerHTML = insights.slice(0, 4).map((insight) => `
        <div class="monthly-insight-card ${insight.tone}">
            <span></span>
            <div>
                <strong>${escapeHtml(insight.title)}</strong>
                <p>${escapeHtml(insight.body)}</p>
            </div>
        </div>
    `).join('');
}

function renderMonthlyCharts(categoryTotals, dailyTotals, text) {
    const categoryCanvas = $('monthlyCategoryChartCanvas');
    const dailyCanvas = $('monthlyDailyChartCanvas');
    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--text').trim() || '#0f172a';
    const gridColor = styles.getPropertyValue('--border').trim() || 'rgba(148, 163, 184, 0.2)';
    const palette = ['#0e7490', '#14b8a6', '#ec4899', '#7c3aed', '#f59e0b'];

    if (categoryCanvas) {
        const categoryValues = categories.map((cat) => Number(categoryTotals[cat.id] || 0));
        const hasData = categoryValues.some((value) => value > 0);
        if (monthlyCategoryChart) monthlyCategoryChart.destroy();
        monthlyCategoryChart = new Chart(categoryCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: hasData ? categories.map((cat) => getCategoryLabel(cat.id)) : [text.monthlyNoData],
                datasets: [{
                    data: hasData ? categoryValues : [1],
                    backgroundColor: hasData ? palette : ['rgba(148, 163, 184, 0.28)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor, boxWidth: 10, usePointStyle: true, font: { weight: 700 } }
                    }
                }
            }
        });
    }

    if (dailyCanvas) {
        if (monthlyDailyChart) monthlyDailyChart.destroy();
        monthlyDailyChart = new Chart(dailyCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: dailyTotals.map((item) => String(item.day).padStart(2, '0')),
                datasets: [{
                    data: dailyTotals.map((item) => item.total),
                    backgroundColor: '#0e7490',
                    borderRadius: 10,
                    maxBarThickness: 18
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: textColor, callback: (value) => `R$ ${Number(value).toLocaleString(getCurrentLocale())}` },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    }
}

function getCardBrand(cardName) {
    const normalized = String(cardName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const logo = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const brands = [
        { match: ['nubank', 'nu '], label: 'Nu', name: 'Nubank', color: '#6d28d9', accent: '#a855f7', logoUrl: logo('nubank.com.br') },
        { match: ['inter'], label: 'Inter', name: 'Inter', color: '#ff7a00', accent: '#ffb020', logoUrl: logo('bancointer.com.br') },
        { match: ['itau', 'itaú'], label: 'Itaú', name: 'Itaú', color: '#003399', accent: '#ff7a00', logoUrl: logo('itau.com.br') },
        { match: ['bradesco'], label: 'B', name: 'Bradesco', color: '#cc092f', accent: '#f43f5e', logoUrl: logo('bradesco.com.br') },
        { match: ['santander'], label: 'S', name: 'Santander', color: '#e60000', accent: '#ff6b6b', logoUrl: logo('santander.com.br') },
        { match: ['banco do brasil', 'bb'], label: 'BB', name: 'Banco do Brasil', color: '#facc15', accent: '#2563eb', text: '#172554', logoUrl: logo('bb.com.br') },
        { match: ['caixa'], label: 'CX', name: 'Caixa', color: '#005ca9', accent: '#f97316', logoUrl: logo('caixa.gov.br') },
        { match: ['c6'], label: 'C6', name: 'C6 Bank', color: '#111827', accent: '#facc15', logoUrl: logo('c6bank.com.br') },
        { match: ['picpay'], label: 'P', name: 'PicPay', color: '#16a34a', accent: '#86efac', logoUrl: logo('picpay.com') },
        { match: ['mercado pago', 'mercadopago'], label: 'MP', name: 'Mercado Pago', color: '#009ee3', accent: '#67e8f9', logoUrl: logo('mercadopago.com.br') },
        { match: ['xp'], label: 'XP', name: 'XP', color: '#111827', accent: '#f59e0b', logoUrl: logo('xpinc.com') },
        { match: ['next'], label: 'N', name: 'Next', color: '#22c55e', accent: '#0f172a', logoUrl: logo('next.me') },
        { match: ['neon'], label: 'Neon', name: 'Neon', color: '#00a5ff', accent: '#00f5d4', logoUrl: logo('neon.com.br') },
        { match: ['will'], label: 'W', name: 'Will', color: '#facc15', accent: '#111827', text: '#111827', logoUrl: logo('willbank.com.br') }
    ];
    const brand = brands.find((item) => item.match.some((key) => normalized.includes(key)));
    if (brand) return brand;
    const initials = String(cardName || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || '?';
    return { label: initials, name: cardName || 'Card', color: '#0e7490', accent: '#14b8a6' };
}

function renderCardLogo(brand, className = 'card-brand-logo') {
    const fallback = escapeHtml(brand.label);
    const style = `--card-brand:${brand.color}; --card-accent:${brand.accent}; --card-text:${brand.text || '#ffffff'};`;
    if (!brand.logoUrl) return `<span class="${className}" style="${style}">${fallback}</span>`;
    return `<span class="${className}" style="${style}"><img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove(); this.parentElement.textContent='${fallback}';"></span>`;
}

function getCardMetaValue(card, keys) {
    const key = keys.find((item) => card?.[item] !== undefined && card?.[item] !== null && card?.[item] !== '');
    return key ? card[key] : null;
}

function getCardBillingPayload(cardId = '') {
    const getValue = (id) => $(id)?.value?.trim() || '';
    const suffix = cardId ? `-${cardId}` : '';
    const prefix = cardId ? 'edit' : 'new';
    const name = getValue(`${prefix}CardName${suffix}`);
    const limit = parseFloat(getValue(`${prefix}CardLimit${suffix}`) || '0') || null;
    const closingDay = parseInt(getValue(`${prefix}CardClosingDay${suffix}`) || '0', 10) || null;
    const dueDay = parseInt(getValue(`${prefix}CardDueDay${suffix}`) || '0', 10) || null;
    return {
        name,
        credit_limit: limit,
        closing_day: closingDay ? Math.min(Math.max(closingDay, 1), 31) : null,
        due_day: dueDay ? Math.min(Math.max(dueDay, 1), 31) : null
    };
}

function isMissingCardBillingColumns(error) {
    return ['credit_limit', 'closing_day', 'due_day'].some((field) => String(error?.message || '').includes(field));
}

function getExpensesForCard(card) {
    return gastos.filter((item) => item.cardId === card.id);
}

function renderCardsPage() {
    const grid = $('cardsGrid');
    if (!grid) return;
    const text = translations[currentLanguage] || translations['pt-BR'];
    const locale = getCurrentLocale();
    const currency = (value) => `R$ ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2 })}`;
    const todayKey = formatDateInputValue(new Date());
    const monthKey = getCurrentMonthKey();
    const cardExpenses = gastos.filter((item) => item.cardId);
    const totalCardSpending = cardExpenses.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const nextInstallments = cardExpenses
        .filter((item) => item.installmentTotal > 1 && item.dataRaw >= todayKey)
        .sort((a, b) => new Date(a.dataRaw) - new Date(b.dataRaw))
        .slice(0, 6);

    if ($('cardsRegisteredValue')) $('cardsRegisteredValue').innerText = String(currentCards.length);
    if ($('cardsTotalSpentValue')) $('cardsTotalSpentValue').innerText = currency(totalCardSpending);

    if (!currentCards.length) {
        grid.innerHTML = `<div class="cards-empty-state">${escapeHtml(text.cardNoCards)}</div>`;
    } else {
        grid.innerHTML = currentCards.map((card) => {
            const brand = getCardBrand(card.name);
            const expenses = getExpensesForCard(card);
            const invoice = expenses
                .filter((item) => item.mes === monthKey)
                .reduce((sum, item) => sum + Number(item.valor || 0), 0);
            const limit = Number(getCardMetaValue(card, ['credit_limit', 'limit_amount', 'limit']) || 0);
            const closing = getCardMetaValue(card, ['closing_day', 'statement_closing_day', 'due_day']);
            const dueDay = getCardMetaValue(card, ['due_day']);
            const limitPercent = limit > 0 ? Math.min((invoice / limit) * 100, 100) : 0;
            const recentExpenses = expenses.slice(0, 4);
            const isEditing = editingCardId === card.id;
            return `
                <article class="card-finance-card" style="--card-brand:${brand.color}; --card-accent:${brand.accent}; --card-text:${brand.text || '#ffffff'};">
                    <div class="card-visual">
                        ${renderCardLogo(brand)}
                        <div>
                            <p>${escapeHtml(brand.name)}</p>
                            <h3>${escapeHtml(card.name)}</h3>
                        </div>
                        <div class="card-action-icons">
                            <button type="button" onclick='toggleCardEdit(${quoteJs(card.id)})' title="${escapeHtml(text.cardManageLabel)}" aria-label="${escapeHtml(text.cardManageLabel)}">
                                <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                            </button>
                            <button type="button" onclick='requestDeleteCard(${quoteJs(card.id)})' title="${escapeHtml(text.cardRemoveButton)}" aria-label="${escapeHtml(text.cardRemoveButton)}">
                                <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="card-finance-metrics">
                        <div>
                            <span>${escapeHtml(text.cardInvoiceLabel)}</span>
                            <strong>${currency(invoice)}</strong>
                        </div>
                        <div>
                            <span>${escapeHtml(text.cardLimitLabel)}</span>
                            <strong>${limit > 0 ? currency(limit) : text.cardLimitNotSet}</strong>
                        </div>
                        <div>
                            <span>${escapeHtml(text.cardClosingLabel)}</span>
                            <strong>${closing ? String(closing).padStart(2, '0') : text.cardClosingNotSet}</strong>
                        </div>
                    </div>
                    <div class="card-edit-panel ${isEditing ? 'is-open' : ''}">
                        <input type="text" id="editCardName-${card.id}" class="input-vr" value="${escapeHtml(card.name)}" placeholder="${escapeHtml(text.cardNamePlaceholder)}">
                        <input type="number" id="editCardLimit-${card.id}" class="input-vr" min="0" step="0.01" inputmode="decimal" value="${limit || ''}" placeholder="${escapeHtml(text.cardLimitPlaceholder)}">
                        <input type="number" id="editCardClosingDay-${card.id}" class="input-vr" min="1" max="31" inputmode="numeric" value="${closing || ''}" placeholder="${escapeHtml(text.cardClosingPlaceholder)}">
                        <input type="number" id="editCardDueDay-${card.id}" class="input-vr" min="1" max="31" inputmode="numeric" value="${dueDay || ''}" placeholder="${escapeHtml(text.cardDuePlaceholder)}">
                    </div>
                    <div class="card-edit-actions ${isEditing ? 'is-open' : ''}">
                        <button type="button" onclick='saveCardDetails(${quoteJs(card.id)})' class="primary-button py-3 rounded-2xl font-black text-[10px] uppercase">${escapeHtml(text.cardSaveButton)}</button>
                        <button type="button" onclick='toggleCardEdit("")' class="ghost-button py-3 rounded-2xl font-black text-[10px] uppercase">${escapeHtml(text.cardCancelButton)}</button>
                    </div>
                    <div class="card-limit-track"><span style="width:${limitPercent}%"></span></div>
                    <div class="card-expense-list">
                        <p class="panel-label">${escapeHtml(text.cardExpensesLabel)}</p>
                        ${recentExpenses.length ? recentExpenses.map((item) => `
                            <div class="card-expense-row">
                                <span>${escapeHtml(item.descricao)}</span>
                                <strong>${currency(item.valor)}</strong>
                            </div>
                        `).join('') : `<div class="card-expense-empty">${escapeHtml(text.cardNoExpenses)}</div>`}
                    </div>
                </article>
            `;
        }).join('');
    }

    if ($('cardsInstallmentsList')) {
        $('cardsInstallmentsList').innerHTML = nextInstallments.length
            ? nextInstallments.map((item) => {
                const card = currentCards.find((currentCard) => currentCard.id === item.cardId);
                const brand = getCardBrand(card?.name || item.metodo);
                return `
                    <div class="installment-row">
                        ${renderCardLogo(brand, 'mini-card-logo')}
                        <div>
                            <strong>${escapeHtml(item.descricao)}</strong>
                            <small>${escapeHtml(card?.name || text.cardMethod)} · ${escapeHtml(getInstallmentLabel(item))} · ${escapeHtml(formatExpenseDate(item.dataRaw))}</small>
                        </div>
                        <b>${currency(item.valor)}</b>
                    </div>
                `;
            }).join('')
            : `<div class="card-expense-empty">${escapeHtml(text.cardNoInstallments)}</div>`;
    }
}

async function handleCardManagerSubmit(event) {
    event.preventDefault();
    const text = translations[currentLanguage] || translations['pt-BR'];
    const payload = getCardBillingPayload();
    if (!payload.name || cartoes.some((name) => name.toLowerCase() === payload.name.toLowerCase())) return;
    const button = $('cardAddButton');
    if (button) button.disabled = true;

    if (!supabaseClient || !currentHousehold) {
        cartoes.push(payload.name);
        currentCards.push({ id: createGroupId(), ...payload });
        renderCardsPage();
        updateSeletorCartaoForm();
        if ($('cardManagerForm')) $('cardManagerForm').reset();
        if (button) button.disabled = false;
        return;
    }

    try {
        let result = await supabaseClient.from('cards').insert({
            household_id: currentHousehold.id,
            name: payload.name,
            credit_limit: payload.credit_limit,
            closing_day: payload.closing_day,
            due_day: payload.due_day,
            created_by: currentSession.user.id
        });
        if (result.error && isMissingCardBillingColumns(result.error)) {
            showToast(text.cardBillingFieldsMissing, 'warning');
            result = await supabaseClient.from('cards').insert({
                household_id: currentHousehold.id,
                name: payload.name,
                created_by: currentSession.user.id
            });
        }
        if (result.error) {
            showToast(result.error.message);
            return;
        }
        if ($('cardManagerForm')) $('cardManagerForm').reset();
        await loadRemoteState();
        renderCardsPage();
        showToast(text.cardSaved, 'safe');
    } finally {
        if (button) button.disabled = false;
    }
}

function toggleCardEdit(cardId) {
    editingCardId = editingCardId === cardId ? null : (cardId || null);
    renderCardsPage();
}

async function saveCardDetails(cardId) {
    const text = translations[currentLanguage] || translations['pt-BR'];
    const payload = getCardBillingPayload(cardId);
    if (!payload.name) return;
    const updatePayload = {
        name: payload.name,
        credit_limit: payload.credit_limit,
        closing_day: payload.closing_day,
        due_day: payload.due_day
    };

    if (!supabaseClient) {
        currentCards = currentCards.map((card) => card.id === cardId ? { ...card, ...updatePayload } : card);
        cartoes = currentCards.map((card) => card.name);
        editingCardId = null;
        renderCardsPage();
        updateSeletorCartaoForm();
        return;
    }

    let result = await supabaseClient.from('cards').update(updatePayload).eq('id', cardId);
    if (result.error && isMissingCardBillingColumns(result.error)) {
        showToast(text.cardBillingFieldsMissing, 'warning');
        result = await supabaseClient.from('cards').update({ name: payload.name }).eq('id', cardId);
    }
    if (result.error) {
        showToast(result.error.message);
        return;
    }
    await loadRemoteState();
    editingCardId = null;
    renderCardsPage();
    showToast(text.cardSaved, 'safe');
}

function requestDeleteCard(cardId) {
    deleteCardIdTemp = cardId;
    const text = translations[currentLanguage] || translations['pt-BR'];
    if ($('deleteCardModalTitle')) $('deleteCardModalTitle').innerText = text.cardDeleteTitle;
    if ($('deleteCardModalText')) $('deleteCardModalText').innerText = text.cardDeleteText;
    if ($('deleteCardModalConfirm')) {
        $('deleteCardModalConfirm').disabled = false;
        $('deleteCardModalConfirm').innerText = text.cardRemoveButton;
    }
    openModal('modalDeleteCard');
}

async function handleDeleteCardConfirm() {
    if (!deleteCardIdTemp) return;
    const text = translations[currentLanguage] || translations['pt-BR'];
    const cardId = deleteCardIdTemp;
    const button = $('deleteCardModalConfirm');
    if (button) {
        button.disabled = true;
        button.innerText = text.saving;
    }
    if (!supabaseClient) {
        currentCards = currentCards.filter((card) => card.id !== cardId);
        cartoes = currentCards.map((card) => card.name);
        deleteCardIdTemp = null;
        closeModal('modalDeleteCard');
        renderCardsPage();
        updateSeletorCartaoForm();
        return;
    }
    const { error } = await supabaseClient.from('cards').delete().eq('id', cardId);
    if (error) {
        showToast(error.message);
        if (button) {
            button.disabled = false;
            button.innerText = text.cardRemoveButton;
        }
        return;
    }
    await loadRemoteState();
    deleteCardIdTemp = null;
    closeModal('modalDeleteCard');
    renderCardsPage();
    showToast(text.cardRemoved, 'safe');
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
        clearMemberColorScope();
        if ($('profilePage')) $('profilePage').classList.add('hidden');
        if ($('monthlyDashboardPage')) $('monthlyDashboardPage').classList.add('hidden');
        if ($('cardsPage')) $('cardsPage').classList.add('hidden');
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

function isMissingCategoryBudgetsTable(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('category_budgets') && (
        message.includes('schema cache') ||
        message.includes('does not exist') ||
        message.includes('not found')
    );
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
    clearMemberColorLeaks();
    const colorScope = $('dashboardPage') || document.documentElement;
    colorScope.style.setProperty('--member-primary', primary);
    colorScope.style.setProperty('--member-primary-text-contrast', primaryText);
    colorScope.style.setProperty('--member-secondary-color', secondary);
    colorScope.style.setProperty('--member-secondary', secondary);
    colorScope.style.setProperty('--member-secondary-text-contrast', secondaryText);
}

function clearMemberColorLeaks() {
    [
        '--primary',
        '--primary-strong',
        '--secondary',
        '--member-primary',
        '--member-primary-text-contrast',
        '--member-secondary-color',
        '--member-secondary',
        '--member-secondary-text-contrast'
    ].forEach((property) => document.documentElement.style.removeProperty(property));
}

function clearMemberColorScope() {
    clearMemberColorLeaks();
    const dashboard = $('dashboardPage');
    if (dashboard) {
        [
            '--member-primary',
            '--member-primary-text-contrast',
            '--member-secondary-color',
            '--member-secondary',
            '--member-secondary-text-contrast'
        ].forEach((property) => dashboard.style.removeProperty(property));
        dashboard.classList.remove('primary-theme', 'secondary-theme');
    }
    $('mainBody').classList.remove('primary-theme', 'secondary-theme');
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
    const text = translations[currentLanguage] || translations['pt-BR'];
    if (row.payment_method === 'credit_card') {
        const card = currentCards.find((item) => item.id === row.card_id);
        return ` ${card?.name || text.cardMethod}`;
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

function getInstallmentLabel(expense) {
    const text = translations[currentLanguage] || translations['pt-BR'];
    return text.installmentOf
        .replace('{current}', expense.installmentNumber)
        .replace('{total}', expense.installmentTotal);
}

function isInstallmentExpense(expense) {
    return Number(expense?.installmentTotal || 1) > 1 && Boolean(expense?.installmentGroupId);
}

function getFilteredExpenses() {
    const filtro = $('filtroMes')?.value || 'all';
    if (filtro === 'installments') return gastos.filter(isInstallmentExpense);
    return filtro === 'all' ? gastos : gastos.filter((item) => item.mes === filtro);
}

function getInstallmentGroups(expenses) {
    const groups = new Map();
    expenses.filter(isInstallmentExpense).forEach((expense) => {
        const key = expense.installmentGroupId;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(expense);
    });
    return Array.from(groups.values())
        .map((items) => items.sort((a, b) => a.installmentNumber - b.installmentNumber))
        .sort((a, b) => new Date(a[0]?.dataRaw || 0) - new Date(b[0]?.dataRaw || 0));
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

function updateEditDropdownLabels() {
    const text = translations[currentLanguage] || translations['pt-BR'];
    const categoryDropdown = $('editCategoriaDropdown');
    if (categoryDropdown) {
        categoryDropdown.innerHTML = categories.map((cat) => `
            <div class="edit-categoria-option px-4 py-3 hover:bg-white/10 cursor-pointer text-sm font-medium transition-colors text-slate-300 ${cat.id === $('editCategoria')?.value ? 'selecionado' : ''}" data-value="${escapeHtml(cat.id)}" onclick='selectEditCategoria(${quoteJs(cat.id)})'>${escapeHtml(getCategoryLabel(cat.id))}</div>
        `).join('');
    }
    if ($('editCategoriaText')) $('editCategoriaText').innerText = getCategoryLabel($('editCategoria')?.value || categoriaSelecionada);
    const cardLabel = text.cardMethod;
    const methodDropdown = $('editMetodoDropdown');
    if (methodDropdown) {
        methodDropdown.innerHTML = `
            <div class="edit-metodo-option px-4 py-3 hover:bg-white/10 cursor-pointer text-sm font-medium transition-colors text-slate-300 ${normalizeMetodo($('editMetodo')?.value) === 'pix' ? 'selecionado' : ''}" data-value="PIX" onclick="selectEditMetodo('PIX')">PIX</div>
            <div class="edit-metodo-option px-4 py-3 hover:bg-white/10 cursor-pointer text-sm font-medium transition-colors text-slate-300 ${isCartaoMetodo($('editMetodo')?.value) ? 'selecionado' : ''}" data-value="${escapeHtml(cardLabel)}" onclick='selectEditMetodo(${quoteJs(cardLabel)})'>${escapeHtml(cardLabel)}</div>
        `;
    }
    if ($('editMetodoText') && isCartaoMetodo($('editMetodo')?.value)) $('editMetodoText').innerText = cardLabel;
    if ($('editCartaoText') && !$('editCartao')?.value) $('editCartaoText').innerText = text.selectCard;
}

function setPayer(pagador) {
    pagadorAtual = pagador;
    const theme = getThemeStyles(getMemberTheme(pagador));
    $('mainBody').className = `pb-10 px-4 ${currentThemeMode}-theme`;
    const dashboard = $('dashboardPage');
    if (dashboard) {
        dashboard.classList.remove('primary-theme', 'secondary-theme');
        dashboard.classList.add(theme.bodyClass);
    }
    $('formContainer').style.borderColor = theme.colorVar;
    $('btnSubmit').style.background = theme.colorVar;
    $('btnSubmit').style.color = theme.textColor;
    renderPayerButtons();
    selecionarCartaoFavorito(pagador);
}

function setHouseholdType(type) {
    householdTypeDraft = type === 'solo' ? 'solo' : 'couple';
    $('btnModeCouple').className = householdTypeDraft === 'couple'
        ? 'household-mode-button py-3 rounded-2xl font-black text-[10px] uppercase is-selected'
        : 'household-mode-button py-3 rounded-2xl font-black text-[10px] uppercase';

    $('btnModeSolo').className = householdTypeDraft === 'solo'
        ? 'household-mode-button py-3 rounded-2xl font-black text-[10px] uppercase is-selected'
        : 'household-mode-button py-3 rounded-2xl font-black text-[10px] uppercase';
    $('editPessoa2Nome').disabled = householdTypeDraft === 'solo';
    $('editPessoa2Nome').parentElement.classList.toggle('opacity-50', householdTypeDraft === 'solo');
}

function setOnboardingHouseholdType(type) {
    onboardingHouseholdType = type === 'solo' ? 'solo' : 'couple';
    $('onboardingModeCouple').className = onboardingHouseholdType === 'couple'
        ? 'household-mode-button py-3 rounded-2xl font-black text-[10px] uppercase is-selected'
        : 'household-mode-button py-3 rounded-2xl font-black text-[10px] uppercase';

    $('onboardingModeSolo').className = onboardingHouseholdType === 'solo'
        ? 'household-mode-button py-3 rounded-2xl font-black text-[10px] uppercase is-selected'
        : 'household-mode-button py-3 rounded-2xl font-black text-[10px] uppercase';
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
        ? (currentLanguage === 'en-US' ? 'Reloads expenses, cards and goal directly from Supabase.' : currentLanguage === 'es-ES' ? 'Recarga gastos, tarjetas y meta directamente desde Supabase.' : 'Recarrega gastos, cartões e meta direto do Supabase.')
        : (currentLanguage === 'en-US' ? 'Downloads all expenses saved in the spreadsheet.' : currentLanguage === 'es-ES' ? 'Descarga todos los gastos guardados en la planilla.' : 'Baixa todos os gastos salvos na planilha.');
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
    const text = translations[currentLanguage] || translations['pt-BR'];
    currentRecoveryMode = true;
    $('authOverlay').classList.remove('hidden');
    animateAuthPanel('recoveryForm');
    $('authMessage').innerText = text.defineNewPassword;
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
    const text = translations[currentLanguage] || translations['pt-BR'];
    const loadingLabel = authMode === 'login'
        ? text.signingIn
        : authMode === 'signup'
            ? text.creating
            : text.sending;

    setAuthButtonLoading(submitButton, true, loadingLabel);
    $('authMessage').innerText = '';
    let completedAuthNavigation = false;

    try {
        if (authMode === 'signup') {
            if (password !== $('authPasswordConfirm').value) {
                $('authMessage').innerText = text.passwordMismatch;
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

            $('authMessage').innerText = error ? error.message : text.accountCreated;
            return;
        }

        if (authMode === 'reset') {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
            $('authMessage').innerText = error ? error.message : text.resetLinkSent;
            return;
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            $('authMessage').innerText = error.message;
            return;
        }

        if (data?.session) {
            setAuthButtonLoading(submitButton, true, text.loginSuccessTitle);
            if ($('loginSuccessTitle')) $('loginSuccessTitle').innerText = text.loginSuccessTitle;
            if ($('loginSuccessText')) $('loginSuccessText').innerText = text.loginSuccessText;
            openModal('modalLoginSuccess');
            await wait(850);
            setAuthButtonLoading(submitButton, true, text.loadingDashboard);
            await handleAuthState(data.session);
            closeModal('modalLoginSuccess');
            completedAuthNavigation = true;
        }
    } catch (stateError) {
        console.error(stateError);
        closeModal('modalLoginSuccess');
        $('authMessage').innerText = stateError.message || text.accountOpenError;
    } finally {
        if (!completedAuthNavigation) {
            setAuthButtonLoading(submitButton, false);
            submitButton.innerText = originalText;
        }
    }
}

async function handleRecoverySubmit(event) {
    event.preventDefault();
    if (!supabaseClient) return;

    const password = $('recoveryPassword').value;
    const confirm = $('recoveryPasswordConfirm').value;
    const text = translations[currentLanguage] || translations['pt-BR'];
    if (!password || password !== confirm) {
        $('authMessage').innerText = text.passwordMismatch;
        return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
        $('authMessage').innerText = error.message;
        return;
    }

    currentRecoveryMode = false;
    $('authMessage').innerText = text.passwordUpdated;
    window.history.replaceState({}, document.title, window.location.pathname);
    await handleAuthState(currentSession);
}

async function logout() {
    if (!supabaseClient) return;
    closeModal('modalLogout');
    await supabaseClient.auth.signOut();
}

function requestLogout() {
    toggleMobileMoreMenu(false);
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

    let categoryBudgetRows = [];
    const budgetResult = await supabaseClient
        .from('category_budgets')
        .select('*')
        .eq('household_id', householdId);
    if (budgetResult.error && !isMissingCategoryBudgetsTable(budgetResult.error)) throw budgetResult.error;
    if (!budgetResult.error) categoryBudgetRows = budgetResult.data || [];

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
    categoryBudgets = {};
    categoryBudgetRows.forEach((row) => {
        categoryBudgets[row.category] = Number(row.monthly_limit || 0);
    });

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
    if ($('onboardingCards')) $('onboardingCards').value = '';
    if ($('onboardingClosingDay')) $('onboardingClosingDay').value = '';
    if ($('onboardingGoalName')) $('onboardingGoalName').value = '';
    if ($('onboardingGoalTarget')) $('onboardingGoalTarget').value = '';
    renderOnboardingCategories();
    setOnboardingHouseholdType('couple');
    $('onboardingMessage').innerText = '';
}

function renderOnboardingCategories() {
    const grid = $('onboardingCategoriesGrid');
    if (!grid) return;
    const selected = getPreferredCategoryOrder();
    grid.innerHTML = categories.map((cat) => `
        <button type="button" class="onboarding-category-chip ${selected.includes(cat.id) ? 'is-active' : ''}" data-category="${escapeHtml(cat.id)}" onclick="toggleOnboardingCategory(this)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${cat.svg}</svg>
            ${escapeHtml(getCategoryLabel(cat.id))}
        </button>
    `).join('');
}

function toggleOnboardingCategory(button) {
    button.classList.toggle('is-active');
}

function getOnboardingSelectedCategories() {
    return Array.from(document.querySelectorAll('.onboarding-category-chip.is-active'))
        .map((button) => button.dataset.category)
        .filter(Boolean);
}

function parseOnboardingCards() {
    return String($('onboardingCards')?.value || '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .filter((name, index, list) => list.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index)
        .slice(0, 8);
}

async function insertOnboardingCards(householdId, cardNames, closingDay) {
    if (!cardNames.length) return;
    const rows = cardNames.map((name) => ({
        household_id: householdId,
        name,
        closing_day: closingDay || null,
        is_active: true
    }));
    let result = await supabaseClient.from('cards').insert(rows);
    if (result.error && String(result.error.message || '').includes('closing_day')) {
        result = await supabaseClient.from('cards').insert(rows.map(({ closing_day, ...row }) => row));
    }
    if (result.error) showToast(result.error.message);
}

async function insertOnboardingGoal(householdId, goalName, goalTarget) {
    if (!goalName && !goalTarget) return;
    const payload = {
        household_id: householdId,
        name: goalName || (translations[currentLanguage] || translations['pt-BR']).savingsGoalLabel,
        target_amount: goalTarget || 0,
        current_amount: 0,
        is_active: true
    };
    const { error } = await supabaseClient.from('savings_goals').insert(payload);
    if (error) showToast(error.message);
}

async function handleOnboardingSubmit(event) {
    event.preventDefault();
    if (!supabaseClient || !currentSession) return;

    const appName = $('onboardingAppName').value.trim();
    const pessoa1 = $('onboardingPessoa1').value.trim();
    const pessoa2 = $('onboardingPessoa2').value.trim();
    const monthlyIncome = parseFloat($('onboardingIncome').value || '0') || null;
    const onboardingCards = parseOnboardingCards();
    const closingDay = Math.min(Math.max(parseInt($('onboardingClosingDay')?.value || '0', 10) || 0, 0), 31);
    const selectedCategories = getOnboardingSelectedCategories();
    const goalName = $('onboardingGoalName')?.value.trim() || '';
    const goalTarget = parseFloat($('onboardingGoalTarget')?.value || '0') || 0;

    if (!appName || !pessoa1 || !monthlyIncome || (onboardingHouseholdType === 'couple' && !pessoa2)) {
        const text = translations[currentLanguage] || translations['pt-BR'];
        $('onboardingMessage').innerText = text.onboardingRequired;
        return;
    }

    const text = translations[currentLanguage] || translations['pt-BR'];
    $('onboardingMessage').innerText = text.onboardingCreating;

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
        $('onboardingMessage').innerText = text.onboardingCreateError;
        return;
    }

    const householdId = typeof data === 'string'
        ? data
        : Array.isArray(data)
            ? data[0]?.household_id || data[0]?.id
            : data?.household_id || data?.id;
    if (householdId) {
        await insertOnboardingCards(householdId, onboardingCards, closingDay);
        await insertOnboardingGoal(householdId, goalName, goalTarget);
    }
    if (selectedCategories.length) {
        localStorage.setItem('pluri_preferred_categories', JSON.stringify(selectedCategories));
    }

    await loadRemoteState();
    hideAllOverlays();
    showAppShell(true);
}

function openConfigModal() {
    closeAppOverlays('modalConfig');
    setMobileNavActive('settings');
    if ($('profilePage')) $('profilePage').classList.add('hidden');
    if ($('monthlyDashboardPage')) $('monthlyDashboardPage').classList.add('hidden');
    if ($('cardsPage')) $('cardsPage').classList.add('hidden');
    if ($('dashboardPage')) $('dashboardPage').classList.remove('hidden');
    if (!currentHousehold) {
        showToast(currentLanguage === 'en-US' ? 'The home has not loaded yet. Try again in a moment.' : currentLanguage === 'es-ES' ? 'La casa aún no se ha cargado. Inténtalo de nuevo en un momento.' : 'A casa ainda não foi carregada. Tente novamente em instantes.');
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
    renderBudgetSettings();
    toggleMetaInputs();
    openModal('modalConfig');
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
    const targetButton = isCartaoMetodo(metodo)
        ? $('met-Cartao')
        : Array.from(document.querySelectorAll('.chip-metodo')).find((button) => normalizeMetodo(button.textContent).includes(normalizeMetodo(metodo)));
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
    const orderedCategories = getOrderedCategories();
    if (!orderedCategories.some((cat) => cat.id === categoriaSelecionada)) categoriaSelecionada = orderedCategories[0]?.id || 'Comida';
    orderedCategories.forEach((cat) => {
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
        const text = translations[currentLanguage] || translations['pt-BR'];
        showToast(text.supabaseRequired);
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
    const submittedCategory = categoriaSelecionada;
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
        showToast(currentLanguage === 'en-US'
            ? 'Installment fields do not exist in Supabase yet. Saving without installment markers.'
            : currentLanguage === 'es-ES'
                ? 'Los campos de cuotas aún no existen en Supabase. Guardando sin marcadores de cuota.'
                : 'Os campos de parcelamento ainda não existem no Supabase. Salvando sem marcadores de parcela.');
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

    const insertedExpenses = (data || []).map(makeUiExpense);
    gastos.unshift(...insertedExpenses);
    gastos.sort((a, b) => new Date(b.dataRaw) - new Date(a.dataRaw));
    render();
    const budgetAlert = insertedExpenses.some((item) => item.mes === getCurrentMonthKey())
        ? getBudgetAlertForCategory(submittedCategory)
        : null;
    event.target.reset();
    $('dataGasto').valueAsDate = new Date();
    toggleInstallments();
    setMetodo('PIX');
    updateSeletorCartaoForm();
    showToast(text.expenseSaved, 'safe');
    if (budgetAlert) showToast(budgetAlert.message, budgetAlert.tone);
}

function confirmDelete(id) {
    const text = translations[currentLanguage] || translations['pt-BR'];
    deleteIdTemp = id;
    deleteContextTemp = 'single';
    deleteInstallmentTemp = null;
    if ($('deleteRecordTitle')) $('deleteRecordTitle').innerText = text.deleteRecordTitle;
    $('confirmDeleteBtn').disabled = false;
    $('confirmDeleteBtn').innerText = text.yes;
    openModal('modalDelete');
}

async function handleDeleteConfirm() {
    if (deleteContextTemp === 'future-installments') {
        await deleteFutureInstallmentsConfirmed();
        return;
    }
    if (!supabaseClient || !deleteIdTemp) return;

    const btn = $('confirmDeleteBtn');
    btn.disabled = true;
    btn.innerText = currentLanguage === 'en-US' ? 'Deleting...' : currentLanguage === 'es-ES' ? 'Eliminando...' : 'Excluindo...';

    const { error } = await supabaseClient.from('expenses').delete().eq('id', deleteIdTemp);
    if (error) {
        showToast(error.message);
        btn.disabled = false;
        const text = translations[currentLanguage] || translations['pt-BR'];
        btn.innerText = text.yes;
        return;
    }

    gastos = gastos.filter((item) => item.id !== deleteIdTemp);
    deleteIdTemp = null;
    closeModal('modalDelete');
    render();
}

async function forceSync() {
    if (!supabaseClient || !currentSession) return;
    setLoading(true, currentLanguage === 'en-US' ? 'Syncing...' : currentLanguage === 'es-ES' ? 'Sincronizando...' : 'Sincronizando...');
    await loadRemoteState();
    setLoading(false);
    showToast(currentLanguage === 'en-US' ? 'Data updated.' : currentLanguage === 'es-ES' ? 'Datos actualizados.' : 'Dados atualizados.');
}

async function saveConfig() {
    const saveButton = $('settingsSaveBtn');
    const text = translations[currentLanguage] || translations['pt-BR'];

    if (!supabaseClient) {
        showToast(currentLanguage === 'en-US' ? 'Supabase client was not initialized.' : currentLanguage === 'es-ES' ? 'El cliente de Supabase no se inicializó.' : 'Cliente do Supabase não inicializado.');
        return;
    }

    if (!currentHousehold) {
        showToast(currentLanguage === 'en-US' ? 'No home was loaded to save settings.' : currentLanguage === 'es-ES' ? 'No se cargó ninguna casa para guardar la configuración.' : 'Nenhuma casa foi carregada para salvar as configurações.');
        return;
    }

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.classList.add('opacity-70', 'cursor-not-allowed');
        saveButton.innerText = text.saving;
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

        const budgetPayload = categories.map((cat) => ({
            household_id: currentHousehold.id,
            category: cat.id,
            monthly_limit: parseFloat($(`budget-${cat.id}`)?.value || '0') || 0
        }));
        const saveBudgets = await supabaseClient
            .from('category_budgets')
            .upsert(budgetPayload, { onConflict: 'household_id,category' });
        if (saveBudgets.error && !isMissingCategoryBudgetsTable(saveBudgets.error)) {
            showToast(saveBudgets.error.message);
            return;
        }
        if (saveBudgets.error && isMissingCategoryBudgetsTable(saveBudgets.error)) {
            showToast(currentLanguage === 'en-US'
                ? 'Category budgets table does not exist yet. Run the budget SQL migration.'
                : currentLanguage === 'es-ES'
                    ? 'La tabla de presupuestos por categoría aún no existe. Ejecuta la migración SQL.'
                    : 'A tabela de orçamentos por categoria ainda não existe. Rode a migração SQL.');
        }

        closeModal('modalConfig');
        await loadRemoteState();
        showToast(text.configSaved);
    } catch (error) {
        console.error('Erro inesperado ao salvar configurações:', error);
        showToast(currentLanguage === 'en-US' ? 'Unexpected error while saving settings.' : currentLanguage === 'es-ES' ? 'Error inesperado al guardar la configuración.' : 'Erro inesperado ao salvar configurações.');
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
    $('editCategoriaText').innerText = getCategoryLabel(valor);
    toggleEditDropdown('categoria', false);
    document.querySelectorAll('.edit-categoria-option').forEach((opt) => opt.classList.toggle('selecionado', opt.dataset.value === valor));
}

function selectEditMetodo(valor) {
    $('editMetodo').value = valor;
    const text = translations[currentLanguage] || translations['pt-BR'];
    $('editMetodoText').innerText = isCartaoMetodo(valor) ? text.cardMethod : valor;
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
    const text = translations[currentLanguage] || translations['pt-BR'];

    $('editId').value = gasto.id;
    $('editDescricao').value = gasto.descricao;
    $('editValor').value = gasto.valor;
    $('editData').value = gasto.dataRaw;
    const installmentPanel = $('editInstallmentPanel');
    const isInstallment = isInstallmentExpense(gasto);
    installmentPanel?.classList.toggle('hidden', !isInstallment);
    if ($('editApplyFutureInstallments')) $('editApplyFutureInstallments').checked = false;
    if (isInstallment) {
        if ($('editInstallmentTitle')) $('editInstallmentTitle').innerText = getInstallmentLabel(gasto);
        if ($('editInstallmentSubtitle')) $('editInstallmentSubtitle').innerText = `${text.installmentGroupLabel} ${String(gasto.installmentGroupId).slice(-6).toUpperCase()}`;
        if ($('editFutureInstallmentsLabel')) $('editFutureInstallmentsLabel').innerText = text.editFutureInstallments;
        if ($('cancelFutureInstallmentsBtn')) {
            $('cancelFutureInstallmentsBtn').innerText = text.cancelFutureInstallments;
            $('cancelFutureInstallmentsBtn').classList.toggle('hidden', gasto.installmentNumber >= gasto.installmentTotal);
        }
    }
    selectEditPagador(gasto.pagador);
    selectEditCategoria(gasto.categoria);

    if (isCartaoMetodo(gasto.metodo)) {
        const option = Array.from(document.querySelectorAll('.edit-metodo-option')).find((item) => isCartaoMetodo(item.dataset.value));
        selectEditMetodo(option?.dataset.value || text.cardMethod);
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
    const currentExpense = gastos.find((item) => item.id === id);
    const member = currentMembers.find((item) => item.display_name === $('editPagador').value);
    const card = currentCards.find((item) => item.name === $('editCartao').value);
    const metodo = $('editMetodo').value;
    const payload = {
        member_id: member?.id,
        card_id: isCartaoMetodo(metodo) ? card?.id || null : null,
        amount: parseFloat($('editValor').value),
        category: $('editCategoria').value,
        description: $('editDescricao').value.trim(),
        payment_method: isCartaoMetodo(metodo) ? 'credit_card' : 'pix'
    };
    const applyFuture = Boolean($('editApplyFutureInstallments')?.checked && isInstallmentExpense(currentExpense));
    const currentOnlyPayload = { ...payload, occurred_on: $('editData').value };

    let query = supabaseClient.from('expenses').update(applyFuture ? payload : currentOnlyPayload);
    if (applyFuture) {
        query = query
            .eq('installment_group_id', currentExpense.installmentGroupId)
            .gte('installment_number', currentExpense.installmentNumber);
    } else {
        query = query.eq('id', id);
    }
    const { data, error } = await query.select();

    if (error) {
        showToast(error.message);
        return;
    }

    const updatedExpenses = Array.isArray(data) ? data.map(makeUiExpense) : [makeUiExpense(data)];
    const updatedById = new Map(updatedExpenses.map((item) => [item.id, item]));
    gastos = gastos.map((item) => updatedById.get(item.id) || item);
    gastos.sort((a, b) => new Date(b.dataRaw) - new Date(a.dataRaw));
    closeModal('modalEdit');
    render();
    const text = translations[currentLanguage] || translations['pt-BR'];
    showToast(text.expenseEdited);
}

async function cancelFutureInstallmentsFromEdit() {
    const text = translations[currentLanguage] || translations['pt-BR'];
    const id = $('editId')?.value;
    const expense = gastos.find((item) => item.id === id);
    if (!supabaseClient || !isInstallmentExpense(expense)) return;
    const futureInstallments = gastos.filter((item) => (
        item.installmentGroupId === expense.installmentGroupId &&
        item.installmentNumber > expense.installmentNumber
    ));
    if (!futureInstallments.length) return;

    deleteContextTemp = 'future-installments';
    deleteInstallmentTemp = {
        groupId: expense.installmentGroupId,
        afterNumber: expense.installmentNumber,
        ids: futureInstallments.map((item) => item.id)
    };
    if ($('deleteRecordTitle')) $('deleteRecordTitle').innerText = text.cancelFutureInstallmentsTitle;
    $('confirmDeleteBtn').disabled = false;
    $('confirmDeleteBtn').innerText = text.yes;
    openModal('modalDelete');
}

async function deleteFutureInstallmentsConfirmed() {
    const text = translations[currentLanguage] || translations['pt-BR'];
    if (!supabaseClient || !deleteInstallmentTemp) return;
    const btn = $('confirmDeleteBtn');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-70');
        btn.innerText = currentLanguage === 'en-US' ? 'Deleting...' : currentLanguage === 'es-ES' ? 'Eliminando...' : 'Excluindo...';
    }
    const { error } = await supabaseClient
        .from('expenses')
        .delete()
        .eq('installment_group_id', deleteInstallmentTemp.groupId)
        .gt('installment_number', deleteInstallmentTemp.afterNumber);

    if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-70');
        btn.innerText = text.yes;
    }
    if (error) {
        showToast(error.message);
        return;
    }

    const idsToRemove = new Set(deleteInstallmentTemp.ids);
    gastos = gastos.filter((item) => !idsToRemove.has(item.id));
    deleteContextTemp = 'single';
    deleteInstallmentTemp = null;
    closeModal('modalDelete');
    closeModal('modalEdit');
    render();
    showToast(text.futureInstallmentsCanceled, 'safe');
}

function renderExpenseCard(gastoOriginal) {
    const originalPagador = gastoOriginal.pagador;
    const isPrimary = getMemberTheme(originalPagador) === 'primary';
    const gasto = {
        ...gastoOriginal,
        pagador: getDisplayMemberName(originalPagador),
        dataDisplay: formatExpenseDate(gastoOriginal.dataRaw)
    };
    const installmentBadge = gasto.installmentTotal > 1
        ? `<span class="installment-badge">${escapeHtml(getInstallmentLabel(gasto))}</span>`
        : '';

    return `
        <div class="expense-card p-3 lg:p-4 ${isPrimary ? 'border-[var(--member-primary)]' : 'border-[var(--member-secondary-color)]'}">
            <div class="hidden lg:flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <span class="w-2 h-2 rounded-full ${isPrimary ? 'bg-[var(--member-primary)]' : 'bg-[var(--member-secondary-color)]'}"></span>
                    <div>
                        <p class="font-bold text-xs expense-title">${escapeHtml(gasto.descricao)}</p>
                        <p class="text-[8px] font-bold uppercase tracking-wider expense-meta">${escapeHtml(gasto.pagador)} &bull; ${escapeHtml(gasto.metodo)} &bull; ${escapeHtml(gasto.dataDisplay)} ${installmentBadge}</p>
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
                    <p class="text-xs font-medium expense-meta">${escapeHtml(gasto.metodo)} &bull; ${escapeHtml(gasto.dataDisplay)} ${installmentBadge}</p>
                    <p class="font-black text-base ${isPrimary ? 'expense-amount-primary' : 'expense-amount-secondary'}">R$ ${gasto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
            </div>
        </div>
    `;
}

function renderEmptyState(type = 'expenses') {
    const text = translations[currentLanguage] || translations['pt-BR'];
    const isInstallment = type === 'installments';
    return `
        <div class="empty-state-card">
            <div class="empty-state-icon">
                ${isInstallment
                    ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 7h8M8 12h8M8 17h5"/><rect x="4" y="3" width="16" height="18" rx="3"/></svg>'
                    : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="5"/></svg>'}
            </div>
            <h3>${escapeHtml(isInstallment ? text.emptyInstallmentsTitle : text.emptyExpensesTitle)}</h3>
            <p>${escapeHtml(isInstallment ? text.emptyInstallmentsText : text.emptyExpensesText)}</p>
        </div>
    `;
}

function render() {
    const lista = $('listaGastos');
    const filtro = $('filtroMes').value;
    const activeMembers = getActiveMembers();
    const totals = Object.fromEntries(activeMembers.map((member) => [member.name, 0]));
    const text = translations[currentLanguage] || translations['pt-BR'];

    lista.innerHTML = '';
    const filtrados = getFilteredExpenses();
    filtrados.forEach((item) => {
        if (totals[item.pagador] !== undefined) totals[item.pagador] += item.valor;
    });

    if (filtro === 'installments') {
        const groups = getInstallmentGroups(filtrados);
        lista.innerHTML = groups.length ? groups.map((items) => {
            const first = items[0];
            const progress = text.installmentGroupProgress
                .replace('{paid}', items.length)
                .replace('{total}', first.installmentTotal);
            return `
                <div class="installment-group-card space-y-3">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="kicker mb-1">${escapeHtml(text.installmentGroupLabel)} ${String(first.installmentGroupId).slice(-6).toUpperCase()}</p>
                            <h3 class="text-lg font-black">${escapeHtml(first.descricao)}</h3>
                            <p class="text-xs mt-1" style="color: var(--text-soft);">${escapeHtml(progress)}</p>
                        </div>
                        <span class="installment-badge">${escapeHtml(getInstallmentLabel(first))}</span>
                    </div>
                    <div class="space-y-3">${items.map(renderExpenseCard).join('')}</div>
                </div>
            `;
        }).join('') : renderEmptyState('installments');
    } else {

    filtrados.forEach((gasto) => {
        const originalPagador = gasto.pagador;
        const isPrimary = getMemberTheme(originalPagador) === 'primary';
        gasto = {
            ...gasto,
            pagador: getDisplayMemberName(originalPagador),
            dataDisplay: formatExpenseDate(gasto.dataRaw)
        };
        const installmentBadge = gasto.installmentTotal > 1
            ? `<span class="installment-badge">${escapeHtml(getInstallmentLabel(gasto))}</span>`
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
        if (!filtrados.length) lista.innerHTML = renderEmptyState('expenses');
    }

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
    renderMonthlyDashboard();
    if ($('cardsPage') && !$('cardsPage').classList.contains('hidden')) renderCardsPage();
    updateMonthlySummaryNotice();
    renderSmartNotifications();
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
    return getFilteredExpenses();
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

function buildPdfReportHtml(rows) {
    const text = translations[currentLanguage] || translations['pt-BR'];
    const total = rows.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const byCategory = rows.reduce((acc, item) => {
        acc[item.categoria] = (acc[item.categoria] || 0) + Number(item.valor || 0);
        return acc;
    }, {});
    const byPayer = rows.reduce((acc, item) => {
        acc[item.pagador] = (acc[item.pagador] || 0) + Number(item.valor || 0);
        return acc;
    }, {});
    const maxCategory = Math.max(...Object.values(byCategory), 1);
    const categoryRows = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => `
            <div class="bar-row">
                <div><strong>${escapeHtml(name)}</strong><span>R$ ${formatMoneyForExport(value)}</span></div>
                <i><b style="width:${Math.max((value / maxCategory) * 100, 6)}%"></b></i>
            </div>
        `).join('');
    const payerCards = Object.entries(byPayer).map(([name, value]) => `
        <div class="stat-card"><span>${escapeHtml(name)}</span><strong>R$ ${formatMoneyForExport(value)}</strong></div>
    `).join('');
    const tableRows = rows.map((item) => `
        <tr>
            <td>${escapeHtml(item.data)}</td>
            <td>${escapeHtml(item.pagador)}</td>
            <td>${escapeHtml(item.categoria)}</td>
            <td>${escapeHtml(item.metodo)}</td>
            <td>${escapeHtml(item.descricao)}</td>
            <td>R$ ${escapeHtml(formatMoneyForExport(item.valor))}</td>
        </tr>
    `).join('');
    const generatedAt = new Date().toLocaleString(getCurrentLocale());
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(text.exportReportHeading)} - ${escapeHtml(appConfig.appName)}</title>
<style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Plus Jakarta Sans", Arial, sans-serif; color: #0f172a; background: #eef7fa; }
.report { max-width: 980px; margin: 0 auto; background: #f8fbfc; padding: 28px; }
.hero { border-radius: 30px; padding: 30px; color: white; background: radial-gradient(circle at 90% 0%, rgba(236,72,153,.55), transparent 30%), linear-gradient(135deg,#0e7490,#0891b2 45%,#64748b); }
.brand { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.logo { width: 58px; height: 58px; border-radius: 20px; background: rgba(255,255,255,.92); display: grid; place-items: center; overflow: hidden; }
.logo img { width: 40px; height: 40px; object-fit: contain; display: block; }
.kicker { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; font-weight: 900; opacity: .8; }
h1 { margin: 14px 0 8px; font-size: 42px; line-height: .95; letter-spacing: -.06em; }
.hero p { max-width: 620px; margin: 0; opacity: .9; }
.stats { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin: 18px 0; }
.stat-card { border: 1px solid #dbe7ee; border-radius: 22px; padding: 18px; background: white; box-shadow: 0 14px 30px rgba(15,23,42,.06); }
.stat-card span { display: block; color: #64748b; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .1em; }
.stat-card strong { display: block; margin-top: 8px; font-size: 24px; }
.section { margin-top: 18px; padding: 20px; border-radius: 26px; background: white; border: 1px solid #dbe7ee; }
.section h2 { margin: 0 0 14px; font-size: 20px; letter-spacing: -.04em; }
.bar-row { display: grid; gap: 8px; margin-bottom: 12px; }
.bar-row div { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
.bar-row span { color: #64748b; font-weight: 800; }
.bar-row i { height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
.bar-row b { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#0e7490,#14b8a6); }
table { width: 100%; border-collapse: collapse; font-size: 11px; overflow: hidden; border-radius: 18px; }
th { text-align: left; color: #64748b; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; background: #f1f5f9; }
td, th { padding: 10px; border-bottom: 1px solid #e2e8f0; }
tr:last-child td { border-bottom: 0; }
.footer { margin-top: 18px; color: #64748b; font-size: 10px; text-align: center; }
@media print { body { background: white; } .report { padding: 0; } }
</style>
</head>
<body>
<main class="report">
    <section class="hero">
        <div class="brand"><div class="logo"><img src="logo-pluri.png" alt="Pluri"></div><div class="kicker">${escapeHtml(generatedAt)}</div></div>
        <h1>${escapeHtml(text.exportReportHeading)}</h1>
        <p>${escapeHtml(appConfig.appName)} | ${rows.length} ${escapeHtml(text.summaryTransactions.toLowerCase())}</p>
    </section>
    <section class="stats">
        <div class="stat-card"><span>${escapeHtml(text.summaryTotal)}</span><strong>R$ ${formatMoneyForExport(total)}</strong></div>
        <div class="stat-card"><span>${escapeHtml(text.summaryAverage)}</span><strong>R$ ${formatMoneyForExport(total / Math.max(rows.length, 1))}</strong></div>
        <div class="stat-card"><span>${escapeHtml(text.summaryTransactions)}</span><strong>${rows.length}</strong></div>
    </section>
    <section class="stats">${payerCards || '<div class="stat-card"><span>-</span><strong>-</strong></div>'}</section>
    <section class="section"><h2>${escapeHtml(text.monthlyCategoryLabel || text.exportHeaderCategory)}</h2>${categoryRows || `<p>${escapeHtml(text.summaryNoCategory)}</p>`}</section>
    <section class="section"><h2>${escapeHtml(text.historyTitle)}</h2><table><thead><tr>${getExportHeaders().map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></section>
    <div class="footer">Pluri Finance</div>
</main>
</body>
</html>`;
}

function exportPdfReport(rows) {
    const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!reportWindow) {
        downloadExport(buildPdfReportHtml(rows), 'html', 'text/html;charset=utf-8');
        return;
    }
    reportWindow.document.open();
    reportWindow.document.write(buildPdfReportHtml(rows));
    reportWindow.document.close();
    reportWindow.onload = () => {
        reportWindow.focus();
        reportWindow.print();
    };
}

function exportarRelatorio() {
    toggleMobileMoreMenu(false);
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

    if (format === 'pdf') {
        exportPdfReport(rows);
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
        const mobileMoreWrap = $('mobileMoreWrap');
        if (mobileMoreWrap && !mobileMoreWrap.contains(event.target)) toggleMobileMoreMenu(false);
        const languageSelect = $('languageSelectWrap');
        if (languageSelect && !languageSelect.contains(event.target)) toggleLanguageDropdown(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            toggleAppMenu(false);
            toggleMobileMoreMenu(false);
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
    if ($('cardManagerForm')) $('cardManagerForm').addEventListener('submit', handleCardManagerSubmit);
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
                    const text = translations[currentLanguage] || translations['pt-BR'];
                    showToast(text.sessionUpdateError);
                    setLoading(false);
                }
            }, 0);
        });

        const { data, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.error(error);
            const text = translations[currentLanguage] || translations['pt-BR'];
            showToast(text.sessionOpenError);
            setLoading(false);
            return;
        }

        await handleAuthState(data.session);
    } catch (error) {
        console.error(error);
        hideAllOverlays();
        showAppShell(false);
        const text = translations[currentLanguage] || translations['pt-BR'];
        showToast(`${text.appStartError}: ${error.message || text.unknownError}`);
        setLoading(false);
    }
}

bootstrap();

