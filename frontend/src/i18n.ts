export type Language = 'es' | 'en';
export type Theme = 'light' | 'dark';

export interface TranslationCatalog {
  pageTitle: string;
  loginMetaTitle: string;
  onboardingMetaTitle: string;
  socialLocale: string;
  appearanceControls: string;
  languageEnglish: string;
  languageSpanish: string;
  switchLanguageToEnglish: string;
  switchLanguageToSpanish: string;
  switchThemeToDark: string;
  switchThemeToLight: string;
  darkTheme: string;
  lightTheme: string;
  eyebrow: string;
  headline: string;
  description: string;
  status: string;
  footer: string;
  uploadFile: string;
  filesHeading: string;
  fileName: string;
  fileSize: string;
  fileStatus: string;
  fileReady: string;
  fileProcessing: string;
  fileFailed: string;
  download: string;
  emptyFiles: string;
  uploading: string;
  uploadSuccess: string;
  uploadQueued: string;
  uploadError: string;
  loadError: string;
  fileLimit: string;
  unknownError: string;
  loginTitle: string;
  loginDescription: string;
  loginWithGoogle: string;
  loginChecking: string;
  loginFailure: string;
  loginErrorGoogle: string;
  loginErrorConfiguration: string;
  loginErrorValidation: string;
  loginErrorProvider: string;
  loginErrorDatabase: string;
  loginErrorServer: string;
  logout: string;
  account: string;
  usernameTitle: string;
  usernameDescription: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  usernameHint: string;
  usernameContinue: string;
  usernameSaving: string;
  usernameTaken: string;
  usernameSaveError: string;
  accountMenu: string;
  accountDetails: string;
  profileName: string;
  profileNameUnavailable: string;
  emailLabel: string;
}

export const translations = {
  es: {
    pageTitle: 'KornSpace — Tus archivos, en su lugar',
    loginMetaTitle: 'KornSpace — Inicio de sesión seguro',
    onboardingMetaTitle: 'KornSpace — Configura tu cuenta',
    socialLocale: 'es_CL',
    appearanceControls: 'Preferencias de apariencia',
    languageEnglish: 'Inglés',
    languageSpanish: 'Español',
    switchLanguageToEnglish: 'Cambiar idioma a inglés',
    switchLanguageToSpanish: 'Cambiar idioma a español',
    switchThemeToDark: 'Activar tema oscuro',
    switchThemeToLight: 'Activar tema claro',
    darkTheme: 'Oscuro',
    lightTheme: 'Claro',
    eyebrow: 'TU ESPACIO PERSONAL',
    headline: 'Tus archivos, en su lugar.',
    description: 'Un espacio sencillo para guardar, organizar y compartir tus archivos.',
    status: 'El espacio de trabajo se está preparando',
    footer: 'Almacenamiento privado para tus cosas.',
    uploadFile: 'Subir archivo',
    filesHeading: 'Tus archivos',
    fileName: 'Nombre',
    fileSize: 'Tamaño',
    fileStatus: 'Estado',
    fileReady: 'Disponible',
    fileProcessing: 'Procesando',
    fileFailed: 'Error',
    download: 'Descargar',
    emptyFiles: 'Aún no hay archivos. Sube uno para comenzar.',
    uploading: 'Subiendo archivo…',
    uploadSuccess: 'El archivo está disponible para descargar.',
    uploadQueued: 'Archivo subido. Se está procesando en segundo plano.',
    uploadError: 'No se pudo subir el archivo.',
    loadError: 'No se pudieron cargar los archivos.',
    fileLimit: 'El tamaño máximo es 100 MiB.',
    unknownError: 'Error inesperado.',
    loginTitle: 'Tus archivos, en un espacio seguro.',
    loginDescription: 'Inicia sesión con Google para subir y consultar tus archivos personales.',
    loginWithGoogle: 'Continuar con Google',
    loginChecking: 'Verificando tu sesión…',
    loginFailure: 'No se pudo verificar la sesión. Inténtalo nuevamente.',
    loginErrorGoogle: 'Google no pudo completar el inicio de sesión. Vuelve a intentarlo.',
    loginErrorConfiguration: 'La autenticación del servidor no está configurada. Revisa las variables OAuth y JWT en .env.',
    loginErrorValidation: 'No se pudo validar la respuesta de Google. Comprueba que el URI de retorno coincida exactamente con el registrado.',
    loginErrorProvider: 'Google rechazó el acceso. Revisa el cliente OAuth y el URI de retorno autorizado.',
    loginErrorDatabase: 'No se pudo guardar tu cuenta. Aplica las migraciones pendientes con pnpm prisma:migrate:deploy.',
    loginErrorServer: 'El servidor no pudo crear la sesión. Revisa los logs del backend y vuelve a intentarlo.',
    logout: 'Cerrar sesión',
    account: 'Cuenta',
    usernameTitle: 'Elige tu nombre de usuario',
    usernameDescription: 'Este nombre identificará tu espacio. Podrás continuar cuando lo hayas elegido.',
    usernameLabel: 'Nombre de usuario',
    usernamePlaceholder: 'tu_nombre',
    usernameHint: 'Usa entre 3 y 24 letras, números o guiones bajos.',
    usernameContinue: 'Continuar',
    usernameSaving: 'Guardando…',
    usernameTaken: 'Ese nombre de usuario ya está en uso. Prueba con otro.',
    usernameSaveError: 'No se pudo guardar el nombre de usuario. Inténtalo de nuevo.',
    accountMenu: 'Abrir menú de cuenta',
    accountDetails: 'Datos de la cuenta',
    profileName: 'Nombre',
    profileNameUnavailable: 'No indicado',
    emailLabel: 'Correo electrónico',
  },
  en: {
    pageTitle: 'KornSpace — Your files, in their place',
    loginMetaTitle: 'KornSpace — Secure sign in',
    onboardingMetaTitle: 'KornSpace — Set up your account',
    socialLocale: 'en_US',
    appearanceControls: 'Appearance preferences',
    languageEnglish: 'English',
    languageSpanish: 'Spanish',
    switchLanguageToEnglish: 'Change language to English',
    switchLanguageToSpanish: 'Change language to Spanish',
    switchThemeToDark: 'Switch to dark theme',
    switchThemeToLight: 'Switch to light theme',
    darkTheme: 'Dark',
    lightTheme: 'Light',
    eyebrow: 'YOUR PERSONAL SPACE',
    headline: 'Your files, in their place.',
    description: 'A simple space to store, organize, and share your files.',
    status: 'Your workspace is getting ready',
    footer: 'Private storage for your things.',
    uploadFile: 'Upload file',
    filesHeading: 'Your files',
    fileName: 'Name',
    fileSize: 'Size',
    fileStatus: 'Status',
    fileReady: 'Available',
    fileProcessing: 'Processing',
    fileFailed: 'Failed',
    download: 'Download',
    emptyFiles: 'No files yet. Upload one to get started.',
    uploading: 'Uploading file…',
    uploadSuccess: 'The file is available to download.',
    uploadQueued: 'File uploaded. It is processing in the background.',
    uploadError: 'The file could not be uploaded.',
    loadError: 'Files could not be loaded.',
    fileLimit: 'Maximum file size is 100 MiB.',
    unknownError: 'Unexpected error.',
    loginTitle: 'Your files, in a space of your own.',
    loginDescription: 'Sign in with Google to upload and access your personal files.',
    loginWithGoogle: 'Continue with Google',
    loginChecking: 'Checking your session…',
    loginFailure: 'Your session could not be verified. Please try again.',
    loginErrorGoogle: 'Google could not complete sign in. Please try again.',
    loginErrorConfiguration: 'Server authentication is not configured. Check the OAuth and JWT variables in .env.',
    loginErrorValidation: 'Google’s response could not be validated. Make sure the callback URI exactly matches the one registered.',
    loginErrorProvider: 'Google rejected the sign in. Check the OAuth client and authorized callback URI.',
    loginErrorDatabase: 'Your account could not be saved. Apply pending migrations with pnpm prisma:migrate:deploy.',
    loginErrorServer: 'The server could not create your session. Check the backend logs and try again.',
    logout: 'Sign out',
    account: 'Account',
    usernameTitle: 'Choose your username',
    usernameDescription: 'This name identifies your space. Choose one to continue.',
    usernameLabel: 'Username',
    usernamePlaceholder: 'your_name',
    usernameHint: 'Use 3 to 24 letters, numbers, or underscores.',
    usernameContinue: 'Continue',
    usernameSaving: 'Saving…',
    usernameTaken: 'That username is already taken. Try another one.',
    usernameSaveError: 'Your username could not be saved. Please try again.',
    accountMenu: 'Open account menu',
    accountDetails: 'Account details',
    profileName: 'Name',
    profileNameUnavailable: 'Not provided',
    emailLabel: 'Email address',
  },
} satisfies Record<Language, TranslationCatalog>;

export function getInitialLanguage(
  savedLanguage: string | null,
  browserLanguage: string,
): Language {
  if (savedLanguage === 'es' || savedLanguage === 'en') {
    return savedLanguage;
  }

  return browserLanguage.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function getInitialTheme(
  savedTheme: string | null,
  prefersDark: boolean,
): Theme {
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  return prefersDark ? 'dark' : 'light';
}

export function getNextLanguage(language: Language): Language {
  return language === 'es' ? 'en' : 'es';
}

export function getNextTheme(theme: Theme): Theme {
  return theme === 'light' ? 'dark' : 'light';
}
