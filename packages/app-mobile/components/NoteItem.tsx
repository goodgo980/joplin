import * as React from 'react';
import { memo, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { Text, View, StyleSheet } from 'react-native';
import Checkbox from './Checkbox';
import Note from '@joplin/lib/models/Note';
import time from '@joplin/lib/time';
import { themeStyle } from './global-style';
import { _ } from '@joplin/lib/locale';
import { AppState } from '../utils/types';
import { Dispatch } from 'redux';
import { NoteEntity } from '@joplin/lib/services/database/types';
import useOnLongPressProps from '../utils/hooks/useOnLongPressProps';
import MultiTouchableOpacity from './buttons/MultiTouchableOpacity';
import { escapeRegExp } from '@joplin/lib/string-utils';
import isNoteLockEnabled from '@joplin/lib/services/noteLock/isNoteLockEnabled';
import NoteLockNote from '@joplin/lib/services/noteLock/NoteLockNote';
import NoteLockSession from '@joplin/lib/services/noteLock/NoteLockSession';
import { DialogContext } from './DialogManager';
import Icon from './Icon';
import { Alert, ToastAndroid } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Menu, MenuOptions, MenuOption, MenuTrigger, renderers } from 'react-native-popup-menu';



interface Props {
	dispatch: Dispatch;
	themeId: number;
	note: NoteEntity;
	noteSelectionEnabled: boolean;
	selectedNoteIds: string[];
	highlightedWord?: string;
	index?: number;
}

const useStyles = (themeId: number, showTopBorder: boolean) => {
	return useMemo(() => {
		const theme = themeStyle(themeId);

		const listItemDivider: ViewStyle = {
			borderTopWidth: showTopBorder ? 1 : 0,
			borderTopColor: theme.dividerColor,
			marginLeft: theme.marginLeft,
			marginRight: theme.marginRight,
		};

		const selectionWrapper: ViewStyle = {
			flexDirection: 'row',
			// backgroundColor: theme.backgroundColor,
		};

		const listItemPressable: ViewStyle = {
			flexGrow: 1,
			flexShrink: 1,
			alignSelf: 'stretch',
			paddingTop: theme.marginTop,
			paddingBottom: theme.marginBottom,
		};
		const listItemPressableWithCheckbox: ViewStyle = {
			...listItemPressable,
			paddingRight: theme.marginRight,
		};
		const listItemPressableWithoutCheckbox: ViewStyle = {
			...listItemPressable,
			paddingLeft: theme.marginLeft,
			paddingRight: theme.marginRight,
		};

		const listItemText: TextStyle = {
			flexShrink: 1,
			color: theme.color,
			fontSize: theme.fontSize,
		};

		const listItemTextWithCheckbox = { ...listItemText };

		const selectionWrapperSelected = { ...selectionWrapper };
		selectionWrapperSelected.backgroundColor = theme.selectedColor;
		selectionWrapperSelected.borderColor = theme.selectedColor;
		selectionWrapperSelected.borderTopWidth = 1;
		selectionWrapperSelected.borderBottomWidth = 1;
		selectionWrapperSelected.marginVertical = -1;

		return StyleSheet.create({
			listItemDivider,
			listItemText,
			titleRow: {
				flexDirection: 'row',
				alignItems: 'center',
			},
			lockIcon: {
				color: theme.colorFaded,
				fontSize: theme.fontSize,
				marginRight: 8,
			},
			selectionWrapper,
			listItemPressableWithoutCheckbox,
			listItemPressableWithCheckbox,
			listItemTextWithCheckbox,
			highlightedText: {
				backgroundColor: theme.searchMarkerBackgroundColor,
				color: theme.searchMarkerColor,
			},
			selectionWrapperSelected,
			checkboxStyle: {
				color: theme.color,
				paddingLeft: theme.marginLeft,
				paddingRight: 10,
			},
			checkedOpacityStyle: {
				opacity: 0.4,
			},
			uncheckedOpacityStyle: { },
		});
	}, [themeId, showTopBorder]);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 库会向 trigger 组件传触摸 props，此处仅透传
const { SlideInMenu } = renderers;
const TriggerPassthrough = React.forwardRef<View, any>(
	(props, ref) => (
		<View ref={ref} collapsable={false}>
			{props.children}
		</View>
	),
);
const NoteItemComponent: React.FC<Props> = memo(props => {
	const styles = useStyles(props.themeId, props.index !== 0);
	const dialogs = useContext(DialogContext);
	const [checkboxKey, setCheckboxKey] = useState(0);
	const suppressPressUntilRef = useRef(0);

	const todoCheckbox_change = useCallback(async (checked: boolean) => {
		if (!props.note) return;

		// Ignore the row press emitted by the checkbox gesture without blocking a deliberate
		// follow-up tap on the row.
		if (isNoteLockEnabled()) suppressPressUntilRef.current = Date.now() + 100;

		// Duplicates the locked-note guard in app-desktop/gui/NoteListItem/NoteListItem.tsx.
		if (isNoteLockEnabled()) {
			const lockState = await Note.load(props.note.id, { fields: ['is_locked'] });
			if (NoteLockNote.isLocked(lockState) && !NoteLockSession.instance().isUnlocked()) {
				// The checkbox keeps its own checked state, so a remount reverts the tick.
				setCheckboxKey(key => key + 1);
				await dialogs.error(_('Cannot change a locked note while the session is locked'));
				return;
			}
		}

		const newNote = {
			id: props.note.id,
			todo_completed: checked ? time.unixMs() : 0,
		};
		await Note.save(newNote);

		props.dispatch({ type: 'NOTE_SORT' });
	}, [props.note, props.dispatch, dialogs]);

	const onPress = useCallback(() => {
		// Suppress touch release triggers during interval, to avoid conflicting with right click event handling on web
		if (Date.now() < suppressPressUntilRef.current) return;
		if (!props.note) return;
		if (props.note.encryption_applied) return;

		if (props.noteSelectionEnabled) {
			props.dispatch({
				type: 'NOTE_SELECTION_TOGGLE',
				id: props.note.id,
			});
		} else {
			props.dispatch({
				type: 'NAV_GO',
				routeName: 'Note',
				noteId: props.note.id,
			});
		}
	}, [props.note, props.noteSelectionEnabled, props.dispatch]);

// ============ 长按菜单：状态与动作 ============
const [menuOpen, setMenuOpen] = useState(false);
const closeMenu = useCallback(() => setMenuOpen(false), []);

const copyNoteContent = useCallback(async () => {
	if (!props.note) return;
	const fullNote = await Note.load(props.note.id);
	if (!fullNote) return;
	Clipboard.setString(`${fullNote.title ?? ''}\n\n${fullNote.body ?? ''}`);
	ToastAndroid.show('已复制到剪贴板', ToastAndroid.SHORT);
}, [props.note]);

const cutNoteToClipboard = useCallback(async () => {
	if (!props.note) return;
	const fullNote = await Note.load(props.note.id);
	if (!fullNote) return;
	Clipboard.setString(`${fullNote.title ?? ''}\n\n${fullNote.body ?? ''}`);
	await Note.delete(fullNote.id);
	ToastAndroid.show('已复制，原笔记已移入回收站', ToastAndroid.SHORT);
}, [props.note]);

const startMultiSelect = useCallback(() => {
	if (!props.note) return;
	props.dispatch({ type: 'NOTE_SELECTION_START', id: props.note.id });
}, [props.dispatch, props.note]);

const deleteNoteWithConfirm = useCallback(() => {
	if (!props.note) return;
	Alert.alert(
		'删除笔记',
		`确定将「${props.note.title ?? '无标题'}」移入回收站吗？`,
		[
			{ text: '取消', style: 'cancel' },
			{
				text: '删除',
				style: 'destructive',
				onPress: async () => {
					await Note.delete(props.note.id);
					ToastAndroid.show('笔记已移入回收站', ToastAndroid.SHORT);
				},
			},
		],
		{ cancelable: true },
	);
}, [props.note]);

// ============ 长按：打开菜单（保留原防抖） ============
const onLongPress = useCallback(() => {
	const now = Date.now();
	if (now < suppressPressUntilRef.current) return;
	suppressPressUntilRef.current = now + 500;
	if (!props.note) return;
	setMenuOpen(true);
}, [props.note]);




	const note = props.note ?? {};
	const isTodo = !!Number(note.is_todo);
	const checkboxChecked = !!Number(note.todo_completed);

	const checkboxStyle = styles.checkboxStyle;
	const listItemTextStyle = isTodo ? styles.listItemTextWithCheckbox : styles.listItemText;
	const opacityStyle = isTodo && checkboxChecked ? styles.checkedOpacityStyle : styles.uncheckedOpacityStyle;
	const isSelected = props.noteSelectionEnabled && props.selectedNoteIds.includes(note.id);

	const selectionWrapperStyle = isSelected ? styles.selectionWrapperSelected : styles.selectionWrapper;

	const noteTitle = Note.displayTitle(note);
	const highlightedWord = props.highlightedWord;
	const displayedNoteTitle = highlightedWord ? noteTitle.split(new RegExp(`(${escapeRegExp(highlightedWord)})`, 'i')).map((part, index) => {
		return part.toLowerCase() === highlightedWord.toLowerCase() ? <Text key={index} style={styles.highlightedText}>{part}</Text> : part;
	}) : noteTitle;
	const selectDeselectLabel = isSelected ? _('Deselect') : _('Select');
	const onLongPressProps = useOnLongPressProps({ onLongPress, actionDescription: selectDeselectLabel });

	const todoCheckbox = isTodo ? <Checkbox
		key={checkboxKey}
		style={checkboxStyle}
		checked={checkboxChecked}
		onChange={todoCheckbox_change}
		accessibilityLabel={_('to-do: %s', noteTitle)}
	/> : null;

	const titleElement = <Text style={listItemTextStyle}>{displayedNoteTitle}</Text>;

	const pressableProps = {
		style: isTodo ? styles.listItemPressableWithCheckbox : styles.listItemPressableWithoutCheckbox,
		accessibilityHint: props.noteSelectionEnabled ? '' : _('Opens note'),
		'aria-pressed': props.noteSelectionEnabled ? isSelected : undefined,
		accessibilityState: { selected: isSelected },
		...onLongPressProps,
	};
	return (
		<Menu renderer={SlideInMenu} opened={menuOpen} onBackdropPress={closeMenu} onSelect={closeMenu}>
		<MenuTrigger customStyles={{ TriggerTouchableComponent: TriggerPassthrough }}>
		<View style={opacityStyle}>
			<View style={styles.listItemDivider}/>
			<MultiTouchableOpacity
				{...pressableProps}
				containerProps={{
					style: selectionWrapperStyle,
				}}
				onPress={onPress}
				beforePressable={todoCheckbox}
			>
				{isNoteLockEnabled() ? (
					<View style={styles.titleRow}>
						{!!note.is_locked && <Icon name='fas fa-lock' style={styles.lockIcon} accessibilityLabel={_('Locked')} />}
						{titleElement}
					</View>
				) : titleElement}
			</MultiTouchableOpacity>
		</View>
		</MenuTrigger>
		<MenuOptions customStyles={{ optionWrapper: { padding: 14 } }}>
			<MenuOption onSelect={() => void copyNoteContent()} text='复制内容' />
			<MenuOption onSelect={() => void cutNoteToClipboard()} text='剪切笔记' />
			<MenuOption onSelect={startMultiSelect} text='多选' />
			<MenuOption onSelect={deleteNoteWithConfirm}>
				<Text style={{ color: '#e5484d', fontSize: 16 }}>删除笔记</Text>
			</MenuOption>
		</MenuOptions>
	</Menu>

	);
});

export default connect((state: AppState) => {
	return {
		themeId: state.settings.theme,
		noteSelectionEnabled: state.noteSelectionEnabled,
		selectedNoteIds: state.selectedNoteIds,
	};
})(NoteItemComponent);
