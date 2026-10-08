import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextStyle,
	View,
	ViewStyle,
	useWindowDimensions,
} from 'react-native';
import { themeStyle } from './global-style';

// 菜单支持的所有动作（与 NoteItem.handleMenuAction 一一对应）
export type NoteMenuAction = 'copy' | 'cut' | 'multiSelect' | 'delete';

// 菜单锚点：长按的那条笔记在屏幕上的位置（由 measureInWindow 测得）
export interface MenuAnchor {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface Props {
	themeId: number;
	anchor: MenuAnchor;
	noteTitle: string;
	onAction: (action: NoteMenuAction) => void;
	onClose: () => void;
}

interface ActionItem {
	key: NoteMenuAction;
	label: string;
	danger?: boolean;
}

const ACTIONS: ActionItem[] = [
	{ key: 'copy', label: '复制内容' },
	{ key: 'cut', label: '剪切笔记' },
	{ key: 'multiSelect', label: '多选' },
	{ key: 'delete', label: '删除笔记', danger: true },
];

// 危险操作（删除）用红色
const DANGER_COLOR = '#E53935';

const MENU_WIDTH = 216;      // 菜单宽度，想加宽/变窄改这里
const MENU_MARGIN = 8;       // 菜单与屏幕边缘、笔记项之间的间距
const EST_MENU_HEIGHT = 212; // 菜单渲染完成前的预估高度（渲染后会自动修正）

const NoteContextMenu: React.FC<Props> = ({ themeId, anchor, noteTitle, onAction, onClose }) => {
	const { width: winWidth, height: winHeight } = useWindowDimensions();

	// 菜单渲染后的真实高度（用于修正位置，防止超出屏幕）
	const [menuHeight, setMenuHeight] = useState(EST_MENU_HEIGHT);

	const styles = useMemo(() => {
		const theme = themeStyle(themeId);

		return StyleSheet.create({
			// 全屏透明层：挡住底下的列表（菜单打开时列表不能滚动），点它即关闭。
			// 想要“背景变暗”的效果，加一行 backgroundColor: 'rgba(0,0,0,0.2)'
			backdrop: {
				...StyleSheet.absoluteFillObject,
			},
			menu: {
				position: 'absolute',
				width: MENU_WIDTH,
				backgroundColor: theme.backgroundColor,
				borderRadius: theme.borderRadius + 4,
				paddingVertical: theme.marginTop,
				overflow: 'hidden',
				// Android 阴影
				elevation: 12,
				// iOS 阴影
				shadowColor: '#000',
				shadowOpacity: 0.3,
				shadowRadius: 10,
				shadowOffset: { width: 0, height: 4 },
			},
			menuTitle: {
				color: theme.colorFaded,
				fontSize: theme.fontSizeSmaller,
				paddingLeft: theme.marginLeft,
				paddingRight: theme.marginRight,
				paddingBottom: theme.marginBottom / 2,
				borderBottomWidth: 1,
				borderBottomColor: theme.dividerColor,
			},
			actionItem: {
				paddingVertical: theme.marginTop + 2,
			},
			actionItemPressed: {
				backgroundColor: theme.backgroundColor2,
			},
			actionText: {
				color: theme.color,
				fontSize: theme.fontSize,
				textAlign: 'center',
			},
			actionTextDanger: {
				color: DANGER_COLOR,
			},
		});
	}, [themeId]);

	const rippleColor = useMemo(() => themeStyle(themeId).dividerColor, [themeId]);

	// ===== 计算菜单位置 =====
	// 规则：优先在笔记项正下方、与其右对齐；下方放不下时翻到上方；最后夹在屏幕内。
	const { menuTop, menuLeft } = useMemo(() => {
		let top = anchor.y + anchor.height + MENU_MARGIN;
		if (top + menuHeight > winHeight - MENU_MARGIN) {
			top = anchor.y - menuHeight - MENU_MARGIN;
		}
		if (top < MENU_MARGIN) top = MENU_MARGIN;

		let left = anchor.x + anchor.width - MENU_WIDTH;
		if (left < MENU_MARGIN) left = MENU_MARGIN;
		if (left > winWidth - MENU_WIDTH - MENU_MARGIN) left = winWidth - MENU_WIDTH - MENU_MARGIN;

		return { menuTop: top, menuLeft: left };
	}, [anchor, menuHeight, winWidth, winHeight]);

	const renderAction = useCallback((item: ActionItem) => {
		return (
			<Pressable
				key={item.key}
				style={({ pressed }) => [styles.actionItem, pressed ? styles.actionItemPressed : null]}
				onPress={() => onAction(item.key)}
				android_ripple={{ color: rippleColor }}
				accessibilityRole='button'
				accessibilityLabel={item.label}
			>
				<Text style={[styles.actionText, item.danger ? styles.actionTextDanger : null]}>
					{item.label}
				</Text>
			</Pressable>
		);
	}, [styles, onAction, rippleColor]);

	return (
		<Modal
			transparent
			visible
			animationType='fade'
			onRequestClose={onClose}
			statusBarTranslucent
			navigationBarTranslucent
		>
			{/* 透明遮罩：拦截列表滚动/点击，点任意空白处关闭 */}
			<Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel='关闭菜单' />
			{/* 浮动菜单本体，出现在长按的那条笔记旁边 */}
			<View
				style={[styles.menu, { top: menuTop, left: menuLeft }]}
				onStartShouldSetResponder={() => true}
				onLayout={(event) => {
					const h = event.nativeEvent.layout.height;
					// 用真实高度修正预估高度
					setMenuHeight((prev) => (prev === h ? prev : h));
				}}
			>
				<Text style={styles.menuTitle} numberOfLines={1}>
					{noteTitle || '笔记操作'}
				</Text>
				{ACTIONS.map(renderAction)}
			</View>
		</Modal>
	);
};

export default NoteContextMenu;
