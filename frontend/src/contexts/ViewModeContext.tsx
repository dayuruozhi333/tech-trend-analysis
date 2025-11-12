/**
 * 视图模式上下文
 * 提供全局的视图模式状态管理
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ViewMode, ViewModeConfig, getViewModeConfig, loadViewModePreference, saveViewModePreference } from '../utils/viewModeConfig';

interface ViewModeContextType {
  viewMode: ViewMode;
  config: ViewModeConfig;
  setViewMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

/**
 * 视图模式提供者组件
 */
export const ViewModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [viewMode, setViewModeState] = useState<ViewMode>(loadViewModePreference);
  const config = getViewModeConfig(viewMode);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    saveViewModePreference(mode);
  };

  // 应用视图模式的CSS变量到document
  useEffect(() => {
    document.documentElement.style.setProperty('--view-primary-color', config.primaryColor);
    document.documentElement.style.setProperty('--view-secondary-color', config.secondaryColor);
    document.documentElement.style.setProperty('--view-bg-color', config.backgroundColor);
  }, [config]);

  return (
    <ViewModeContext.Provider value={{ viewMode, config, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
};

/**
 * 使用视图模式上下文的Hook
 */
export function useViewMode(): ViewModeContextType {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error('useViewMode必须在ViewModeProvider内使用');
  }
  return context;
}











