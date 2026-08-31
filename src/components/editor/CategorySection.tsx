import React, { useState, useCallback, useMemo } from 'react';
import { useAppBase } from '../../hooks/useAppBase';
import { Category, LineItem, Tag } from '../../types';
import { calcCategoryTotal } from '../../utils/calculations';
import {
  groupItemsBySubCategory,
  ensureSubCategory,
  updateSubCategory,
  deleteSubCategory,
  mergeSubCategories,
  moveSubCategory,
  hasSubCategories,
  findSubCategoryIdByName,
} from '../../utils/subCategories';
import { suggestedSubCategories, SubCategorySuggestion } from '../../utils/defaultSubCategories';
import { SuggestGroupsModal } from './SuggestGroupsModal';
import { LineItemRow } from './LineItemRow';
import { AddItemRow } from './AddItemRow';
import { SubCategoryGroupHeader } from './SubCategoryGroupHeader';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { Badge } from '../common/Badge';
import { ChevronDown, ChevronRight, FolderPlus, Sparkles } from 'lucide-react';
import './CategorySection.css';
import './SubCategoryGroupHeader.css';

interface CategorySectionProps {
  category: Category;
  exchangeRates: Record<string, number>;
  snapshotMonth: string;
  onChange: (updated: Category) => void;
  /** Snapshot-wide tag registry — cross-category, so it lives above this component. */
  tags?: Tag[];
  onAssignTags?: (itemId: string, target: { toggleId: string } | { newName: string }) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({ category, exchangeRates, snapshotMonth, onChange, tags, onAssignTags }) => {
  const { preferences, confirm } = useAppBase();
  const baseCurrency = preferences?.baseCurrency || 'INR';
  const enabledCurrencies = preferences?.enabledCurrencies || ['INR', 'USD', 'EUR', 'GBP', 'SGD'];
  const [isExpanded, setIsExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const total = calcCategoryTotal(category, baseCurrency, exchangeRates);
  const grouped = hasSubCategories(category);
  const suggestions = suggestedSubCategories(category.id);
  // The trigger stays available once a category already has groups, so the picker
  // can be used to top up later — it just hides when nothing is left to add.
  const unusedSuggestions = suggestions.filter(s => !findSubCategoryIdByName(category, s.name));
  const countedItems = category.items.filter(i => !i.excludeFromNetWorth).length;

  const handleAddItem = useCallback((item: LineItem) => {
    onChange({ ...category, items: [...category.items, item] });
  }, [category, onChange]);

  const handleUpdateItem = useCallback((updated: LineItem) => {
    onChange({ ...category, items: category.items.map(i => i.id === updated.id ? updated : i) });
  }, [category, onChange]);

  const handleRemoveItem = useCallback((id: string) => {
    onChange({ ...category, items: category.items.filter(i => i.id !== id) });
  }, [category, onChange]);

  /**
   * Assigning an item to a group is one `onChange`, even when the group has to be
   * created first. Splitting it into two calls would not work: both would read the
   * same stale `category` prop in the same tick and the second would overwrite the
   * first, losing the new definition.
   */
  const handleAssignSubCategory = useCallback(
    (itemId: string, target: { id: string } | { newName: string }) => {
      const { category: withDef, id } = 'newName' in target
        ? ensureSubCategory(category, target.newName)
        : { category, id: target.id };

      onChange({
        ...withDef,
        items: withDef.items.map(i => {
          if (i.id !== itemId) return i;
          if (!id) {
            const { subCategoryId: _dropped, ...rest } = i;
            return rest;
          }
          return { ...i, subCategoryId: id };
        }),
      });
    },
    [category, onChange],
  );

  const commitNewGroup = useCallback(() => {
    const trimmed = newGroupName.trim();
    setNewGroupName('');
    setAddingGroup(false);
    if (!trimmed) return;
    const { category: next, created } = ensureSubCategory(category, trimmed);
    if (created) onChange(next);
  }, [newGroupName, category, onChange]);

  /**
   * Every accepted suggestion is folded into ONE onChange over an accumulator.
   * Calling onChange per group would have each call read the same stale `category`
   * prop, so only the last would survive.
   */
  const applySelected = useCallback((chosen: SubCategorySuggestion[]) => {
    let next = category;
    for (const s of chosen) next = ensureSubCategory(next, s.name, s.description).category;
    if (next !== category) onChange(next);
  }, [category, onChange]);

  const handleEditGroup = useCallback(async (
    id: string,
    patch: { name: string; description: string },
  ) => {
    const { category: next, collidesWith } = updateSubCategory(category, id, patch);
    if (!collidesWith) { onChange(next); return; }

    // A rename that collides is almost always the user trying to unify two groups
    // they consider the same. Offer exactly that instead of refusing the edit.
    const target = category.subCategories?.find(s => s.id === collidesWith);
    const ok = await confirm(
      `A group called “${target?.name}” already exists in ${category.name}. Merge this group into it?`,
    );
    if (ok) onChange(mergeSubCategories(category, id, collidesWith));
  }, [category, onChange, confirm]);

  const handleDeleteGroup = useCallback(async (id: string) => {
    const group = category.subCategories?.find(s => s.id === id);
    const count = category.items.filter(i => i.subCategoryId === id).length;

    // Deliberately the opposite of the category-level delete guard, which blocks
    // deletion while items exist: a sub-group is organisational, so removing it
    // changes no total and loses nothing.
    if (count > 0) {
      const ok = await confirm(
        `Delete “${group?.name}”? Its ${count} ${count === 1 ? 'item moves' : 'items move'} ` +
        `to Ungrouped — nothing is deleted.`,
        'destructive',
      );
      if (!ok) return;
    }
    onChange(deleteSubCategory(category, id));
  }, [category, onChange, confirm]);

  const groups = useMemo(
    () => groupItemsBySubCategory(category, baseCurrency, exchangeRates, { includeEmpty: true }),
    [category, baseCurrency, exchangeRates],
  );

  const toggleGroup = (id: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const renderItems = (items: LineItem[]) => items.map(item => (
    <LineItemRow
      key={item.id}
      item={item}
      exchangeRates={exchangeRates}
      snapshotMonth={snapshotMonth}
      onChange={handleUpdateItem}
      onRemove={handleRemoveItem}
      subCategories={grouped ? category.subCategories : undefined}
      onAssignSubCategory={grouped ? handleAssignSubCategory : undefined}
      tags={tags}
      onAssignTags={onAssignTags}
    />
  ));

  const addGroupControls = (
    <div className="subcat-add">
      {addingGroup ? (
        <input
          autoFocus
          type="text"
          className="subcat-add__input"
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          onBlur={commitNewGroup}
          onKeyDown={e => {
            if (e.key === 'Enter') commitNewGroup();
            else if (e.key === 'Escape') { setNewGroupName(''); setAddingGroup(false); }
          }}
          placeholder="Group name"
          aria-label={`New sub-group in ${category.name}`}
        />
      ) : (
        <>
          <button
            type="button"
            className="subcat-add__btn"
            onClick={() => setAddingGroup(true)}
            aria-label={`Add a sub-group to ${category.name}`}
          >
            <FolderPlus size={13} /> Sub-group
          </button>
          {unusedSuggestions.length > 0 && (
            <button
              type="button"
              className="subcat-add__btn"
              onClick={() => setPickerOpen(true)}
              aria-label={`Add suggested sub-groups to ${category.name}`}
            >
              <Sparkles size={13} /> Suggest groups
            </button>
          )}
        </>
      )}
      {grouped && (
        <span className="subcat-add__hint">
          Sub-groups organise items. Liquid/Investable is set per category in Settings;
          goal exclusions are set per item with the Σ chips.
        </span>
      )}
    </div>
  );

  return (
    <>
      <div className="category-section glass-card">
        <div className="category-section__header" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="category-section__title-group">
            <span className="category-section__toggle">
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </span>
            <span className="category-section__name">{category.name}</span>
            <Badge variant={category.type === 'asset' ? 'positive' : 'negative'}>{category.type}</Badge>
            <span className="category-section__count">
              {countedItems === category.items.length
                ? `${category.items.length} item${category.items.length === 1 ? '' : 's'}`
                : `${countedItems} of ${category.items.length} items counted`}
            </span>
          </div>
          <div className={`category-section__total ${category.type === 'asset' ? 'positive' : 'negative'}`}>
            <CurrencyDisplay amount={total} currency={baseCurrency} />
          </div>
        </div>

        {isExpanded && (
          <div className="category-section__body">
            {/* No groups defined → render exactly as before sub-categories existed.
                Forcing group chrome onto twelve default categories would be a
                regression for every user who never asked for grouping. */}
            {!grouped ? (
              <div className="category-section__items">
                {renderItems(category.items)}
                <AddItemRow
                  baseCurrency={baseCurrency}
                  enabledCurrencies={enabledCurrencies}
                  onAdd={handleAddItem}
                />
              </div>
            ) : (
              groups.map(group => {
                const key = group.id ?? '__ungrouped__';
                const collapsed = collapsedGroups.has(key);
                const namedGroups = category.subCategories ?? [];
                const groupIdx = namedGroups.findIndex(s => s.id === group.id);

                return (
                  <div
                    key={key}
                    className={`subcat-group${group.id === null ? ' subcat-group--ungrouped' : ''}`}
                  >
                    {/* The ungrouped bucket hides its header when it is the only
                        bucket with anything in it — no point labelling "Ungrouped"
                        when there is nothing to contrast it against. */}
                    {!(group.id === null && groups.length === 1) && (
                      <SubCategoryGroupHeader
                        id={group.id}
                        name={group.name}
                        itemCount={group.items.length}
                        total={group.total}
                        baseCurrency={baseCurrency}
                        collapsed={collapsed}
                        onToggleCollapse={() => toggleGroup(key)}
                        siblings={namedGroups.filter(s => s.id !== group.id)}
                        isFirst={groupIdx === 0}
                        isLast={groupIdx === namedGroups.length - 1}
                        description={namedGroups.find(sc => sc.id === group.id)?.description}
                        onEdit={patch => handleEditGroup(group.id!, patch)}
                        onMove={delta => onChange(moveSubCategory(category, group.id!, delta))}
                        onMerge={intoId => onChange(mergeSubCategories(category, group.id!, intoId))}
                        onDelete={() => handleDeleteGroup(group.id!)}
                      />
                    )}

                    {!collapsed && (
                      <div className="category-section__items subcat-group__items">
                        {renderItems(group.items)}
                        <AddItemRow
                          key={`add-${key}`}
                          baseCurrency={baseCurrency}
                          enabledCurrencies={enabledCurrencies}
                          onAdd={handleAddItem}
                          subCategoryId={group.id ?? undefined}
                          subCategoryName={group.id ? group.name : undefined}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {addGroupControls}
          </div>
        )}
      </div>

      {pickerOpen && (
        <SuggestGroupsModal
          category={category}
          suggestions={suggestions}
          onClose={() => setPickerOpen(false)}
          onAdd={applySelected}
        />
      )}
    </>
  );
};
