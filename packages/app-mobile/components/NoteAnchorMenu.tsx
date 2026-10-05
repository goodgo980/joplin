import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, ToastAndroid, View, ViewStyle } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Note from '@joplin/lib/models/Note';
import { themeStyle } from './global-style';
import { NoteEntity } from '@joplin/lib/services/database/types';
import { Dispatch } from 'redux';

interface Props {
	visible: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	noteId: string;
	themeId: number;
	dispatch: Dispatch;
	onClose: () => void;
}

const MENU_WIDTH = 176;
const MENU_ROW_HEIGHT = 46;
const MENU_HEIGHT = MENU_ROW_HEIGHT * 3;

const NoteAnchorMenu: React.FC<Props> = props => {
	const theme = themeStyle(props.themeId);
	const [fullNote, setFullNote] = useState<NoteEntity | null>(null);

	useEffect(() => {
		if (!props.visible) {
			setFullNote(null);
			return;
		}
		let cancelled = false;
		void Note.load(props.noteId).then(note => {
			if (!cancelled) setFullNote(note);
		});
		return () => {
			cancelled = true;
		};
	}, [props.visible, props.noteId]);

	const runAction = useCallback((action: string) => {
		props.onClose();
		const note = fullNote;
		if (!note) return;

		const noteContent = `${note.title ?? ''}\n\n${note.body ?? ''}`;

		if (action === 'copy') {
			Clipboard.setString(noteContent);
			ToastAndroid.show('已复制到剪贴板', ToastAndroid.SHORT);
		} else if (action === 'cut') {
			Clipboard.setString(noteContent);
			void Note.delete(note.id).then(() => {
				ToastAndroid.show('已复制，原笔记已移入回收站', ToastAndroid.SHORT);
			});
		} else if (action === 'select') {
			props.dispatch({ type: 'NOTE_SELECTION_TOGGLE', id: note.id });
		}
	}, [fullNote, props]);

	if (!props.visible) return null;

	const screen = Dimensions.get('window');
	const menuX = Math.max(8, Math.min(props.x + props.width - MENU_WIDTH - 8, screen.width - MENU_WIDTH - 8));
	const belowY = props.y + props.height + 4;
	const menuY = belowY + MENU_HEIGHT > screen.height - 30
		? Math.max(8, props.y - MENU_HEIGHT - 4)
		: belowY;

	const menuStyle: ViewStyle = {
		position: 'absolute',
		left: menuX,
		top: menuY,
		width: MENU_WIDTH,
		backgroundColor: theme.backgroundColor,
		borderRadius: 10,
		elevation: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 6,
		overflow: 'hidden',
	};

	const rowStyle: ViewStyle = {
		height: MENU_ROW_HEIGHT,
		justifyContent: 'center',
		paddingHorizontal: 16,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: theme.dividerColor,
	};

	const textStyle = {
		color: theme.color,
		fontSize: theme.fontSize,
	};

	return (
		<Modal
			visible={true}
			transparent={true}
			animationType='fade'
			onRequestClose={props.onClose}
			statusBarTranslucent={true}
			navigationBarTranslucent={true}
		>
			<Pressable style={{ flex: 1 }} onPress={props.onClose}>
				<View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }}>
					<Pressable style={menuStyle} onPress={() => {}}>
						<Pressable style={rowStyle} onPress={() => runAction('copy')}>
							<Text style={textStyle}>复制内容</Text>
						</Pressable>
						<Pressable style={rowStyle} onPress={() => runAction('cut')}>
							<Text style={textStyle}>剪切笔记</Text>
						</Pressable>
						<Pressable style={[rowStyle, { borderBottomWidth: 0 }]} onPress={() => runAction('select')}>
							<Text style={textStyle}>多选</Text>
						</Pressable>
					</Pressable>
				</View>
			</Pressable>
		</Modal>
	);
};

export default NoteAnchorMenu;
