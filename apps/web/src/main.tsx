import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/*
       * React Router 7 difiere por defecto la actualización de la ruta con
       * startTransition. En pantallas pesadas esto puede adelantar la URL y
       * dejar visible indefinidamente la ruta anterior. La navegación de
       * Edusyn debe confirmar URL y contenido como una sola actualización.
       */}
      <BrowserRouter unstable_useTransitions={false}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
