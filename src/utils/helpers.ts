/**
 * BACKLOG NETWORK — Utilities centralizadas
 * Substitui código duplicado em 10+ telas
 */
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Share, Alert } from 'react-native';

/**
 * Converte uma data (string ISO ou Date) para formato relativo: "há 2min", "há 3h", etc.
 */
export const timeAgo = (date: string | Date | undefined | null): string => {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Sanity check — datas inválidas
    if (isNaN(dateObj.getTime())) return '';

    let distance = formatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: ptBR,
    });

    // Encurta para um visual mais "clean"
    return distance
      .replace('aproximadamente ', '')
      .replace('menos de um minuto atrás', 'agora')
      .replace('há cerca de ', 'há ')
      .replace('há menos de um minuto', 'agora')
      .replace('cerca de ', '');
  } catch {
    return '';
  }
};

/**
 * Abre o menu de compartilhamento padrão do sistema
 */
export const onShare = async (message: string, url?: string) => {
  try {
    await Share.share({
      message: `${message}${url ? '\n' + url : ''}`,
    });
  } catch {
    Alert.alert('Erro', 'Não foi possível compartilhar.');
  }
};

/**
 * Formata contadores grandes: 1200 → "1.2K", 1500000 → "1.5M"
 */
export const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return String(n);
};
