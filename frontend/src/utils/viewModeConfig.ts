/**
 * 视图模式配置系统
 * 为不同使用者提供差异化的界面展示倾向
 */

export type ViewMode = 'explore' | 'learn' | 'compare' | 'decide';

/**
 * 视图模式配置接口
 */
export interface ViewModeConfig {
  // 模式信息
  id: ViewMode;
  name: string;
  description: string;
  icon: string;
  
  // 视觉样式
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  
  // 布局偏好
  defaultTab: 'list' | 'trend' | 'map';
  showMetrics: boolean; // 是否显示详细指标
  showComparisons: boolean; // 是否显示对比功能
  showLearningPath: boolean; // 是否显示学习路径
  
  // 信息优先级
  highlightGrowth: boolean; // 突出增长趋势
  highlightBasics: boolean; // 突出基础知识
  highlightDifferences: boolean; // 突出差异对比
  highlightRecommendations: boolean; // 突出推荐建议
  
  // 排序和筛选偏好
  sortBy: 'growth' | 'popularity' | 'stability' | 'relevance';
  showAllTopics: boolean; // 是否显示所有主题（还是只显示重点）
  
  // 图表配置
  chartEmphasis: 'trends' | 'distribution' | 'comparison' | 'insights';
  showBaseline: boolean; // 是否显示基线
  showAnnotations: boolean; // 是否显示注释
}

/**
 * 视图模式配置映射
 */
export const viewModeConfigs: Record<ViewMode, ViewModeConfig> = {
  explore: {
    id: 'explore',
    name: '探索模式',
    description: '适合探索技术领域，发现新兴趋势和热点',
    icon: '🔍',
    primaryColor: '#3b82f6', // 蓝色 - 探索
    secondaryColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    defaultTab: 'trend',
    showMetrics: true,
    showComparisons: false,
    showLearningPath: false,
    highlightGrowth: true,
    highlightBasics: false,
    highlightDifferences: false,
    highlightRecommendations: false,
    sortBy: 'growth',
    showAllTopics: true,
    chartEmphasis: 'trends',
    showBaseline: true,
    showAnnotations: true,
  },
  
  learn: {
    id: 'learn',
    name: '学习模式',
    description: '适合学习和理解技术概念，获取基础知识',
    icon: '📚',
    primaryColor: '#10b981', // 绿色 - 学习
    secondaryColor: '#6ee7b7',
    backgroundColor: '#ecfdf5',
    defaultTab: 'list',
    showMetrics: true,
    showComparisons: false,
    showLearningPath: true,
    highlightGrowth: false,
    highlightBasics: true,
    highlightDifferences: false,
    highlightRecommendations: true,
    sortBy: 'relevance',
    showAllTopics: false,
    chartEmphasis: 'distribution',
    showBaseline: false,
    showAnnotations: false,
  },
  
  compare: {
    id: 'compare',
    name: '比较模式',
    description: '适合对比不同技术主题，分析差异和优劣',
    icon: '⚖️',
    primaryColor: '#f59e0b', // 橙色 - 比较
    secondaryColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    defaultTab: 'trend',
    showMetrics: true,
    showComparisons: true,
    showLearningPath: false,
    highlightGrowth: false,
    highlightBasics: false,
    highlightDifferences: true,
    highlightRecommendations: false,
    sortBy: 'stability',
    showAllTopics: true,
    chartEmphasis: 'comparison',
    showBaseline: true,
    showAnnotations: true,
  },
  
  decide: {
    id: 'decide',
    name: '决策模式',
    description: '适合技术决策，获取可落地的建议和风险评估',
    icon: '💼',
    primaryColor: '#8b5cf6', // 紫色 - 决策
    secondaryColor: '#c4b5fd',
    backgroundColor: '#f5f3ff',
    defaultTab: 'map',
    showMetrics: true,
    showComparisons: true,
    showLearningPath: false,
    highlightGrowth: true,
    highlightBasics: false,
    highlightDifferences: true,
    highlightRecommendations: true,
    sortBy: 'relevance',
    showAllTopics: false,
    chartEmphasis: 'insights',
    showBaseline: true,
    showAnnotations: true,
  },
};

/**
 * 获取视图模式配置
 */
export function getViewModeConfig(mode: ViewMode): ViewModeConfig {
  return viewModeConfigs[mode] || viewModeConfigs.explore;
}

/**
 * 获取所有视图模式列表
 */
export function getAllViewModes(): ViewModeConfig[] {
  return Object.values(viewModeConfigs);
}

/**
 * 保存视图模式偏好到本地存储
 */
export function saveViewModePreference(mode: ViewMode): void {
  try {
    const raw = localStorage.getItem('tta_prefs');
    const obj = raw ? JSON.parse(raw) : {};
    obj.viewMode = mode;
    localStorage.setItem('tta_prefs', JSON.stringify(obj));
  } catch (error) {
    console.warn('保存视图模式偏好失败:', error);
  }
}

/**
 * 从本地存储加载视图模式偏好
 */
export function loadViewModePreference(): ViewMode {
  try {
    const raw = localStorage.getItem('tta_prefs');
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj.viewMode === 'string') {
        if (['explore', 'learn', 'compare', 'decide'].includes(obj.viewMode)) {
          return obj.viewMode as ViewMode;
        }
      }
    }
  } catch (error) {
    console.warn('加载视图模式偏好失败:', error);
  }
  return 'explore'; // 默认返回探索模式
}









