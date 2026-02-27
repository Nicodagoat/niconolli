import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useStore } from '../../store';

export default function Layout() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen bg-brand-dark">
      <Sidebar />
      <div className={`flex flex-col flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
