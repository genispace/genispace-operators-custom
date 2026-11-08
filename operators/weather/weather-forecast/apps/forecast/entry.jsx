import React from 'react';
import Detail from './detail.js';
import { mountApp } from '../../../../../mcp-apps/runtime.jsx';
import Summary from './summary.js';
mountApp({ title: "Weather forecast", Detail, Summary });
