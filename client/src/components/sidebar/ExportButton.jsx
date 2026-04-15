import { Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore.js';

export default function ExportButton() {
  const { currentSession, messages, sources } = useAppStore();

  const handleExport = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    let y = 18;
    const left = 16;
    const pageWidth = 178;

    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235);
    doc.text('Curalink Research Brief', left, y);
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Disease: ${currentSession?.disease || 'N/A'}`, left, y);
    y += 5;
    doc.text(
      `Location: ${currentSession?.location?.city || 'Unknown city'}, ${currentSession?.location?.country || 'Unknown country'}`,
      left,
      y
    );
    y += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, left, y);
    y += 8;

    doc.setDrawColor(148, 163, 184);
    doc.line(left, y, 194, y);
    y += 8;

    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.structuredAnswer);

    if (lastAssistant?.structuredAnswer) {
      const answer = lastAssistant.structuredAnswer;

      const writeSection = (title, text, fontSize = 10) => {
        if (y > 260) {
          doc.addPage();
          y = 18;
        }

        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(title, left, y);
        y += 5;

        doc.setFontSize(fontSize);
        doc.setTextColor(51, 65, 85);
        const lines = doc.splitTextToSize(text || '', pageWidth);
        doc.text(lines, left, y);
        y += lines.length * 5 + 4;
      };

      writeSection('Condition overview', answer.condition_overview || '');

      if (answer.research_insights?.length) {
        if (y > 245) {
          doc.addPage();
          y = 18;
        }
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('Research findings', left, y);
        y += 6;
        answer.research_insights.slice(0, 5).forEach((insight, index) => {
          const lines = doc.splitTextToSize(`${index + 1}. ${insight.insight}`, pageWidth);
          doc.setFontSize(10);
          doc.setTextColor(51, 65, 85);
          doc.text(lines, left, y);
          y += lines.length * 4.5 + 2;
        });
      }

      if (answer.recommendations) {
        writeSection('Guidance', answer.recommendations);
      }
    }

    if (sources.length) {
      if (y > 240) {
        doc.addPage();
        y = 18;
      }

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('Research sources', left, y);
      y += 6;

      let publicationCount = 0;
      let trialCount = 0;

      sources.slice(0, 8).forEach((source) => {
        if (y > 265) {
          doc.addPage();
          y = 18;
        }

        let sourceLabel = source.citationId;
        if (!sourceLabel) {
          if (source.type === 'publication') {
            publicationCount += 1;
            sourceLabel = `P${publicationCount}`;
          } else {
            trialCount += 1;
            sourceLabel = `T${trialCount}`;
          }
        }
        const titleLines = doc.splitTextToSize(`[${sourceLabel}] ${source.title || 'Untitled source'}`, pageWidth);
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.text(titleLines, left, y);
        y += titleLines.length * 4.5 + 1;

        if (source.url) {
          doc.setTextColor(59, 130, 246);
          doc.text(source.url, left + 2, y);
          y += 4.5;
        }
      });
    }

    doc.save(`curalink-${(currentSession?.disease || 'research').replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-800 bg-blue-950 px-4 py-2 text-sm font-medium text-blue-300 transition hover:border-blue-600 hover:text-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
    >
      <Download size={14} />
      Export research brief
    </button>
  );
}