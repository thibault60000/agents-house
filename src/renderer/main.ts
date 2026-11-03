import '@fontsource-variable/fredoka';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/tokens.css';
import './styles/glass.css';
import { mount } from 'svelte';
import App from './ui/App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('#app introuvable');
if (window.house) mount(App, { target });
else target.textContent = "Cette page s'ouvre dans l'application Maison des Agents.";
