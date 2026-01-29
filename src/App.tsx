import { useState, useEffect } from 'react';
import { VacationRecord, VacationType } from './types';
import {
  generateId,
  countWorkDays,
  countWorkDaysByYear,
  calculateYearlyStats,
  calculateCarryOver,
  isWithinCarryOverPeriod,
  saveToStorage,
  loadFromStorage,
  formatDisplayDate,
  formatDateString,
} from './utils';
import { getPublicHolidays } from './holidays';
import {
  Calendar,
  Plus,
  Trash2,
  Sun,
  Palmtree,
  AlertCircle,
  CheckCircle,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

function App() {
  // 使用惰性初始化直接从 localStorage 加载数据
  const [records, setRecords] = useState<VacationRecord[]>(() => {
    const saved = loadFromStorage();
    return saved;
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const stored = localStorage.getItem('urlaub_selected_year');
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const employmentStartDate = '2025-08-01';

  // 表单状态
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<VacationType>('statutory');

  // 保存数据到 localStorage
  useEffect(() => {
    saveToStorage(records);
  }, [records]);

  // 记住当前选择的年份，避免刷新或热更新后跳回当前年
  useEffect(() => {
    localStorage.setItem('urlaub_selected_year', String(selectedYear));
  }, [selectedYear]);

  // 计算统计数据（包含上一年法定结转）
  const todayDate = new Date();
  const isCurrentYear = selectedYear === todayDate.getFullYear();
  const carryOverFromPreviousYear =
    isCurrentYear && isWithinCarryOverPeriod(selectedYear - 1, todayDate)
      ? calculateCarryOver(records, selectedYear - 1, employmentStartDate)
      : 0;
  const stats = calculateYearlyStats(
    records,
    selectedYear,
    carryOverFromPreviousYear,
    employmentStartDate
  );
  const yearlyTotal = stats.statutoryTotal + stats.contractualTotal;

  // 获取该年的假期记录
  const yearRecords = records
    .filter((r) => Number(r.year) === Number(selectedYear))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  // 获取公共假日
  const publicHolidays = getPublicHolidays(selectedYear);

  // 计算预览工作日（按年份拆分）
  const previewByYear = (formStartDate && formEndDate && formStartDate <= formEndDate)
    ? countWorkDaysByYear(formStartDate, formEndDate)
    : [];

  const previewWorkDays = previewByYear.reduce((sum, p) => sum + p.days, 0);
  const previewAllocations = previewByYear.map((p) => {
    const currentStats = calculateYearlyStats(records, p.year, 0, employmentStartDate);
    const contractualRemaining = currentStats.contractualRemaining;
    const overflow = formType === 'contractual' ? Math.max(0, p.days - contractualRemaining) : 0;
    return {
      ...p,
      contractualRemaining,
      overflowToStatutory: overflow,
    };
  });

  // 添加假期记录
  const handleAddRecord = () => {
    if (!formStartDate || !formEndDate || formStartDate > formEndDate) {
      alert('请选择有效的日期范围');
      return;
    }

    const totalWorkDays = countWorkDays(formStartDate, formEndDate);
    if (totalWorkDays === 0) {
      alert('所选日期范围内没有工作日');
      return;
    }

    // 按年份拆分假期
    const splitByYear = countWorkDaysByYear(formStartDate, formEndDate);
    const createdAt = new Date().toISOString();
    const description = formDescription || '假期';

    // 为每个年份创建记录，合同不足时自动扣除法定假期
    const newRecords: VacationRecord[] = [];
    const tempRecords: VacationRecord[] = [...records];

    splitByYear.forEach((period) => {
      const periodLabel = splitByYear.length > 1 ? `${period.year}年部分` : '';
      const baseDescription = periodLabel ? `${description} (${periodLabel})` : description;

      if (formType === 'contractual') {
        const currentStats = calculateYearlyStats(tempRecords, period.year, 0, employmentStartDate);
        const contractualRemaining = currentStats.contractualRemaining;
        const contractualDays = Math.min(contractualRemaining, period.days);
        const statutoryDays = period.days - contractualDays;

        if (contractualDays > 0) {
          newRecords.push({
            id: generateId(),
            startDate: period.startDate,
            endDate: period.endDate,
            workDays: contractualDays,
            description: statutoryDays > 0
              ? `${baseDescription}（合同优先）`
              : baseDescription,
            type: 'contractual',
            year: period.year,
            createdAt,
          });
        }

        if (statutoryDays > 0) {
          newRecords.push({
            id: generateId(),
            startDate: period.startDate,
            endDate: period.endDate,
            workDays: statutoryDays,
            description: `${baseDescription}（超出合同自动转法定）`,
            type: 'statutory',
            year: period.year,
            createdAt,
          });
        }
      } else {
        newRecords.push({
          id: generateId(),
          startDate: period.startDate,
          endDate: period.endDate,
          workDays: period.days,
          description: baseDescription,
          type: 'statutory',
          year: period.year,
          createdAt,
        });
      }

      tempRecords.push(...newRecords.filter((r) => r.year === period.year));
    });

    setRecords((prev) => [...prev, ...newRecords]);
    resetForm();
    setShowAddForm(false);
  };

  // 删除记录
  const handleDeleteRecord = (id: string) => {
    if (confirm('确定要删除这条记录吗？')) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormStartDate('');
    setFormEndDate('');
    setFormDescription('');
    setFormType('statutory');
  };

  // 计算进度百分比
  const totalUsed = stats.statutoryUsed + stats.contractualUsed;
  const totalRemaining = stats.statutoryRemaining + stats.contractualRemaining;

  // 判断今天的日期
  const today = formatDateString(new Date());

  const handleYearChange = (delta: number) => {
    setSelectedYear((prev) => {
      const next = prev + delta;
      localStorage.setItem('urlaub_selected_year', String(next));
      return next;
    });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Palmtree size={32} />
            <h1>Urlaubsverwaltung</h1>
          </div>
          <p className="subtitle">假期管理系统 · Baden-Württemberg</p>
        </div>
      </header>

      <main className="main" key={selectedYear}>
        {/* 年份选择器 */}
        <div className="year-selector">
          <button
            className="year-btn"
            onClick={() => handleYearChange(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <span className="year-display">{selectedYear}</span>
          <button
            className="year-btn"
            onClick={() => handleYearChange(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="stats-grid">
          <div className="stat-card main-stat">
            <div className="stat-header">
              <Sun size={24} />
              <span>年度假期概览</span>
            </div>
            <div className="stat-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill statutory"
                  style={{ width: `${yearlyTotal > 0 ? (stats.statutoryUsed / yearlyTotal) * 100 : 0}%` }}
                />
                <div
                  className="progress-fill contractual"
                  style={{
                    width: `${yearlyTotal > 0 ? (stats.contractualUsed / yearlyTotal) * 100 : 0}%`,
                    left: `${yearlyTotal > 0 ? (stats.statutoryUsed / yearlyTotal) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="progress-labels">
                <span>已用 {totalUsed} 天</span>
                <span>剩余 {totalRemaining} 天</span>
              </div>
            </div>
            <div className="stat-breakdown">
              <div className="breakdown-item">
                <span className="dot statutory" />
                <span>法定假期 (Gesetzlich)</span>
                <span className="breakdown-value">
                  {stats.statutoryUsed} / {stats.statutoryTotal} 天
                </span>
              </div>
              <div className="breakdown-item">
                <span className="dot contractual" />
                <span>合同假期 (Vertraglich)</span>
                <span className="breakdown-value">
                  {stats.contractualUsed} / {stats.contractualTotal} 天
                </span>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon statutory-bg">
              <CheckCircle size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">法定假期剩余</span>
              <span className="stat-value">{stats.statutoryRemaining} 天</span>
            </div>
            <div className="stat-note">
              <Info size={14} />
              <span>可结转至次年3月31日</span>
              {carryOverFromPreviousYear > 0 && (
                <span className="carryover-note">
                  （已结转 {carryOverFromPreviousYear} 天）
                </span>
              )}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon contractual-bg">
              <AlertCircle size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-label">合同假期剩余</span>
              <span className="stat-value">{stats.contractualRemaining} 天</span>
            </div>
            <div className="stat-note warning">
              <Info size={14} />
              <span>12月31日过期</span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={18} />
            记录假期
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowHolidays(!showHolidays)}
          >
            <Calendar size={18} />
            {showHolidays ? '隐藏公共假日' : '查看公共假日'}
          </button>
        </div>

        {/* 添加假期表单 */}
        {showAddForm && (
          <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>📅 记录假期</h2>
              <div className="form-group">
                <label>开始日期</label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>结束日期</label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
              </div>
              {(formStartDate || formEndDate) && (
                <div className="date-summary">
                  已选择日期：{formStartDate ? formatDisplayDate(formStartDate) : '—'} — {formEndDate ? formatDisplayDate(formEndDate) : '—'}
                  <div className="date-summary-raw">
                    原始值：{formStartDate || '—'} — {formEndDate || '—'}
                  </div>
                </div>
              )}
              {previewWorkDays > 0 && (
                <div className="preview-days">
                  <div className="preview-header">
                    <span>消耗假期天数：</span>
                    <strong>{previewWorkDays} 天</strong>
                  </div>
                  <div className="preview-note">（已自动排除周末和公共假日）</div>
                  {previewByYear.length > 0 && (
                    <div className="preview-split">
                      <div className="split-title">
                        {previewByYear.length > 1 ? '⚠️ 跨年假期，将按年份自动拆分：' : '按年份计入配额：'}
                      </div>
                      {previewAllocations.map((p) => (
                        <div key={p.year} className="split-item">
                          <span>{p.year}年：</span>
                          <strong>{p.days} 天</strong>
                          <span className="split-dates">
                            ({formatDisplayDate(p.startDate)} - {formatDisplayDate(p.endDate)})
                          </span>
                          {formType === 'contractual' && p.overflowToStatutory > 0 && (
                            <span className="split-warning">
                              合同剩余{p.contractualRemaining}天，超出{p.overflowToStatutory}天将自动转法定
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="form-group">
                <label>假期类型</label>
                <div className="type-selector">
                  <button
                    className={`type-btn ${formType === 'statutory' ? 'active statutory' : ''}`}
                    onClick={() => setFormType('statutory')}
                  >
                    法定假期
                    <small>Gesetzlich ({stats.statutoryRemaining}天剩余)</small>
                  </button>
                  <button
                    className={`type-btn ${formType === 'contractual' ? 'active contractual' : ''}`}
                    onClick={() => setFormType('contractual')}
                  >
                    合同假期
                    <small>Vertraglich ({stats.contractualRemaining}天剩余)</small>
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>备注（可选）</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="例如：圣诞假期、回国探亲..."
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>
                  取消
                </button>
                <button className="btn btn-primary" onClick={handleAddRecord}>
                  保存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 公共假日列表 */}
        {showHolidays && (
          <div className="section">
            <h2>🎌 {selectedYear}年 巴登-符腾堡州公共假日</h2>
            <div className="holidays-grid">
              {publicHolidays.map((holiday) => {
                const isPast = holiday.date < today;
                return (
                  <div
                    key={holiday.date}
                    className={`holiday-card ${isPast ? 'past' : ''}`}
                  >
                    <div className="holiday-date">
                      {formatDisplayDate(holiday.date)}
                    </div>
                    <div className="holiday-name">{holiday.nameZh}</div>
                    <div className="holiday-name-de">{holiday.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 假期记录列表 */}
        <div className="section">
          <h2>📋 {selectedYear}年 假期记录</h2>
          <div className="year-summary">
            本年度：已用 <strong>{stats.statutoryUsed}</strong> 天法定 + <strong>{stats.contractualUsed}</strong> 天合同 = 共 <strong>{stats.statutoryUsed + stats.contractualUsed}</strong> 天
          </div>
          {yearRecords.length === 0 ? (
            <div className="empty-state">
              <Palmtree size={48} />
              <p>暂无假期记录</p>
              <p className="empty-hint">点击"记录假期"开始添加</p>
            </div>
          ) : (
            <div className="records-list">
              {yearRecords.map((record) => (
                <div key={record.id} className="record-card">
                  <div className="record-dates">
                    <span className="record-range">
                      {formatDisplayDate(record.startDate)}
                      {record.startDate !== record.endDate && (
                        <> — {formatDisplayDate(record.endDate)}</>
                      )}
                    </span>
                    <div className="record-tags">
                      <span className={`record-type ${record.type}`}>
                        {record.type === 'statutory' ? '法定' : '合同'}
                      </span>
                      <span className="record-year">计入{record.year}年</span>
                    </div>
                  </div>
                  <div className="record-info">
                    <span className="record-days">消耗 {record.workDays} 天假期</span>
                    {record.description && (
                      <span className="record-desc">{record.description}</span>
                    )}
                  </div>
                  <button
                    className="record-delete"
                    onClick={() => handleDeleteRecord(record.id)}
                    title="删除记录"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 规则说明 */}
        <div className="section rules">
          <h2>📖 假期规则说明</h2>
          <div className="rules-content">
            <div className="rule-item">
              <h4>年假总额</h4>
              <p>每年28天假期（基于五天工作周）= 20天法定假期 + 8天合同额外假期</p>
            </div>
            <div className="rule-item">
              <h4>假期过期</h4>
              <p>
                <strong>合同假期</strong>：每年12月31日过期，不可结转<br />
                <strong>法定假期</strong>：如因病无法休假，可结转至次年3月31日（15个月）
              </p>
            </div>
            <div className="rule-item">
              <h4>离职规则</h4>
              <p>
                下半年离职时，假期按月份比例计算（不低于法定最低假期）；
                剩余假期需在离职期内休完，合同额外假期在离职时失效
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Urlaubsverwaltung für Baden-Württemberg · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
