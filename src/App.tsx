import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from './state/AppState';
import Layout from './components/Layout';
import NotFound from './components/NotFound';

// BASE_URL is '/free-museums-france/' in every mode (see vite.config.ts).
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route
          element={
            <AppStateProvider>
              <Outlet />
            </AppStateProvider>
          }
        >
          <Route path="/" element={<Layout />} />
          <Route path="/museum/:id" element={<Layout />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
