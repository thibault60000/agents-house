import { join } from 'node:path';
import { app } from 'electron';

app.setPath('userData', join(app.getPath('appData'), 'Maison des Agents'));
